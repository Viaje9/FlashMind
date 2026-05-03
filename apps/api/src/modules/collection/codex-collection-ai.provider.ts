import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
  CollectionAiCandidate,
  CollectionAiChatInput,
  CollectionAiChatResult,
  CollectionAiProvider,
  CollectionChatIntent,
} from './collection-ai.provider';
import { CollectionToolService } from './collection-tool.service';
import { CollectionItemKindDto, CollectionRelationTypeDto } from './dto';

const DEFAULT_MODEL = 'gpt-5.5';
const DEFAULT_MODEL_REASONING_EFFORT = 'low';
const DEFAULT_TIMEOUT_MS = 45_000;
const MODEL_REASONING_EFFORTS = [
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
] as const;

type ModelReasoningEffort = (typeof MODEL_REASONING_EFFORTS)[number];

type CodexThreadOptions = ReturnType<
  CodexCollectionAiProvider['createThreadOptions']
>;

interface CodexThread {
  readonly id: string | null;
  run(
    input: string,
    turnOptions: { outputSchema: unknown; signal: AbortSignal },
  ): Promise<{ finalResponse: string }>;
}

interface CodexClient {
  startThread(options: CodexThreadOptions): CodexThread;
  resumeThread(id: string, options: CodexThreadOptions): CodexThread;
}

interface CodexSdkModule {
  Codex: new () => CodexClient;
}

const COLLECTION_AGENT_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    intent: {
      type: 'string',
      enum: Object.values(CollectionChatIntent),
    },
    message: { type: 'string' },
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: Object.values(CollectionItemKindDto),
          },
          text: { type: 'string' },
          meaning: { type: 'string' },
          sourceWord: { type: ['string', 'null'] },
          sourceCardIds: {
            type: 'array',
            items: { type: 'string' },
          },
          relatedCandidates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: Object.values(CollectionRelationTypeDto),
                },
                kind: {
                  type: 'string',
                  enum: [
                    CollectionItemKindDto.COLLOCATION,
                    CollectionItemKindDto.PHRASE,
                    CollectionItemKindDto.CLAUSE,
                  ],
                },
                text: { type: 'string' },
                meaning: { type: 'string' },
                sourceCardIds: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              required: ['type', 'kind', 'text', 'meaning', 'sourceCardIds'],
              additionalProperties: false,
            },
          },
        },
        required: [
          'kind',
          'text',
          'meaning',
          'sourceWord',
          'sourceCardIds',
          'relatedCandidates',
        ],
        additionalProperties: false,
      },
    },
    suggestedCards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          word: { type: 'string' },
          meaning: { type: ['string', 'null'] },
        },
        required: ['id', 'word', 'meaning'],
        additionalProperties: false,
      },
    },
  },
  required: ['intent', 'message', 'candidates', 'suggestedCards'],
  additionalProperties: false,
} as const;

@Injectable()
export class CodexCollectionAiProvider extends CollectionAiProvider {
  private codex: CodexClient | null = null;
  private readonly model: string;
  private readonly modelReasoningEffort: ModelReasoningEffort;
  private readonly timeoutMs: number;

  constructor(
    private readonly tools: CollectionToolService,
    configService: ConfigService,
  ) {
    super();
    this.model =
      configService.get<string>('COLLECTION_CODEX_MODEL') ?? DEFAULT_MODEL;
    this.modelReasoningEffort = this.parseModelReasoningEffort(
      configService.get<string>('COLLECTION_CODEX_REASONING_EFFORT'),
    );
    this.timeoutMs =
      Number(configService.get<string>('COLLECTION_CODEX_TIMEOUT_MS')) ||
      DEFAULT_TIMEOUT_MS;
  }

  async runChat(input: CollectionAiChatInput): Promise<CollectionAiChatResult> {
    this.assertCodexOauthReady();

    const [vocabularySummary, searchedCards, existingCollections] =
      await Promise.all([
        this.tools.getUserVocabularySummary(input.userId, 24),
        this.tools.searchUserCards(input.userId, input.message, 20),
        this.tools.searchCollectionItems(input.userId, input.message, 20),
      ]);
    const codex = await this.getCodex();
    const thread = input.providerThreadId
      ? codex.resumeThread(input.providerThreadId, this.createThreadOptions())
      : codex.startThread(this.createThreadOptions());
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.timeoutMs);

    try {
      const turn = await thread.run(
        this.buildPrompt(input, {
          vocabularySummary,
          searchedCards,
          existingCollections,
        }),
        {
          outputSchema: COLLECTION_AGENT_OUTPUT_SCHEMA,
          signal: abortController.signal,
        },
      );
      const parsed = this.parseResult(turn.finalResponse);
      const candidates = await this.markExistingCandidates(
        input.userId,
        parsed,
      );

      return {
        providerThreadId: thread.id ?? input.providerThreadId,
        intent: parsed.intent,
        message: parsed.message,
        candidates:
          parsed.intent === CollectionChatIntent.TRANSLATE_ONLY
            ? []
            : candidates,
        suggestedCards: parsed.suggestedCards,
      };
    } catch (error) {
      throw this.mapCodexError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  private createThreadOptions() {
    return {
      model: this.model,
      modelReasoningEffort: this.modelReasoningEffort,
      sandboxMode: 'read-only' as const,
      approvalPolicy: 'never' as const,
      networkAccessEnabled: false,
      skipGitRepoCheck: true,
      workingDirectory: process.cwd(),
    };
  }

  private parseModelReasoningEffort(
    value: string | undefined,
  ): ModelReasoningEffort {
    if (
      value &&
      MODEL_REASONING_EFFORTS.includes(value as ModelReasoningEffort)
    ) {
      return value as ModelReasoningEffort;
    }

    return DEFAULT_MODEL_REASONING_EFFORT;
  }

  private async getCodex(): Promise<CodexClient> {
    if (this.codex) {
      return this.codex;
    }

    // @openai/codex-sdk is ESM-only, so keep this as a runtime dynamic import.
    const { Codex } = (await import('@openai/codex-sdk')) as CodexSdkModule;
    this.codex = new Codex();

    return this.codex;
  }

  private buildPrompt(
    input: CollectionAiChatInput,
    context: {
      vocabularySummary: Awaited<
        ReturnType<CollectionToolService['getUserVocabularySummary']>
      >;
      searchedCards: Awaited<
        ReturnType<CollectionToolService['searchUserCards']>
      >;
      existingCollections: Awaited<
        ReturnType<CollectionToolService['searchCollectionItems']>
      >;
    },
  ) {
    const vocabularyCards = context.vocabularySummary.sampleCards.map(
      (card) => ({
        id: card.id,
        word: card.front,
        meaning: card.meanings[0]?.zhMeaning ?? '',
      }),
    );
    const searchedCards = context.searchedCards.map((card) => ({
      id: card.id,
      word: card.front,
      meaning: card.meanings[0]?.zhMeaning ?? '',
    }));
    const existingCollections = context.existingCollections.map((item) => ({
      id: item.id,
      kind: item.kind.toLowerCase(),
      text: item.text,
      meaning: item.zhMeaning ?? '',
      sourceWords: item.cardLinks.map((link) => link.card.front),
    }));
    const intentPolicy = this.buildIntentPolicy(input);

    return [
      '你是 FlashMind 收藏包的英文學習助理。',
      '你的任務是依使用者意圖回覆，並在適合時提出可收藏的句子、搭配詞、片語、子句候選。message 請簡短，不要把 candidates 逐字重複列成清單。',
      '純聊天偏好延續規則：如果同一個 Codex thread 歷史中，使用者曾要求「純聊天、不要卡片、不要收藏候選、不要回傳任何卡片」，後續每一輪都必須維持 candidates 與 suggestedCards 為空陣列，只用 message 自然聊天或回答問題。這個偏好會持續到使用者明確要求「怎麼說、我想說、拆語塊、收藏、整理可收藏內容、給我可用句子」才解除。',
      '只可根據後端提供的使用者單字卡 id 產生 sourceCardIds；不可捏造 card id。頂層語塊候選必須盡量錨定至少一張既有單字卡；若沒有可錨定的既有單字卡，可以只回句子候選並在 message 提醒建議新增的單字。',
      '分類定義：',
      '- sentence：完整英文句子，通常有主詞與主要動詞，可獨立表達完整意思。',
      '- collocation：自然搭配詞，是常一起出現的具體字詞組合，例如 make a reservation、fall behind schedule、heavy rain。必須是實際可說出口的文字，不可使用 ___、...、+ V-ing、括號、斜線或文法模板。',
      '- phrase：片語，比搭配詞更大的積木，用來補充時間、地點、方式、目的、對象等資訊；本身不可有「完整主詞 + 限定動詞」。片語可以包含搭配詞，例如 after falling behind schedule。',
      '- clause：子句，必須有明確主詞與限定動詞，通常由 because、although、if、when、before、after、so 等連接詞引導；不可是完整多句段落。',
      '分類判斷優先順序：有明確主詞與限定動詞才可標 clause；沒有主詞與限定動詞但補充細節標 phrase；常一起出現且可直接嵌入句子的短組合標 collocation；完整句標 sentence。',
      '禁止把語塊寫成文法標籤或模板，例如 have ___ for dinner、feel like + V-ing、make + noun 都不可作為收藏候選；請改成實際語塊，例如 have chicken rice for dinner、feel like having chicken rice。',
      '如果產生 sentence 候選，relatedCandidates 必須放入這句中可拆出的搭配詞、片語、子句，且 text 優先必須能在 sentence text 中找到原文片段。sentence 底下的新語塊即使沒有既有單字卡可連結，也可以保留並讓 sourceCardIds 為空；若沒有高品質拆解，relatedCandidates 回空陣列。',
      '如果 sentence 內有 because、although、if、when、before、after、so 引導，且該片段有自己的主詞與限定動詞，必須優先拆成 clause，不要降級成 phrase。',
      'sentence 候選的 sourceCardIds 請使用其 relatedCandidates 的 sourceCardIds 聯集；若整句只是翻譯且沒有既有單字卡可連結，sourceCardIds 可為空。',
      '如果產生 collocation 候選，relatedCandidates 可放入包含該搭配詞的 phrase 或 clause；如果產生 phrase/clause 候選，relatedCandidates 可放入其包含的 collocation。',
      '非 sentence 的頂層語塊候選若無法連到至少一張既有單字卡，請不要放入 candidates；可改放在 sentence.relatedCandidates 或 message 作為建議新增單字或表達。',
      '句子拆解範例：I’d like to push the meeting back by one day. 的 relatedCandidates 至少應包含 push the meeting back（collocation，將會議往後延）與 by one day（phrase，延後一天）。',
      '句子拆解範例：We’re falling behind schedule because the vendor delayed the delivery. 的 relatedCandidates 至少應包含 fall behind schedule（collocation，進度落後）與 because the vendor delayed the delivery（clause，因為供應商延誤交付）。',
      '句子拆解範例：Although the deadline is tight, we can still finish the project. 的 relatedCandidates 至少應包含 tight deadline（collocation，緊迫期限）與 Although the deadline is tight（clause，雖然期限很緊）。',
      'relation type 規則：sentence -> collocation 用 sentence_has_collocation；sentence -> phrase 用 sentence_has_phrase；sentence -> clause 用 sentence_has_clause；phrase -> collocation 用 phrase_has_collocation；clause -> collocation 用 clause_has_collocation。',
      'translate_only 僅限使用者明確要求「只翻譯 / 單純翻譯 / translate only / 不要收藏候選」時使用，candidates 必須是空陣列。',
      '口說練習情境規則：如果使用者要求練習口說情境、roleplay、對話主題，或用「第一個、開始、換旅遊、再難一點、簡單一點」延續上一輪情境，message 只回情境任務或下一句角色扮演提示；candidates 與 suggestedCards 必須為空陣列。只有當使用者明確要求「怎麼說、我想說、拆語塊、收藏、整理可收藏內容」時才產生候選。',
      '如果使用者只貼一句中文或英文，沒有明確要求只翻譯，裸句子不能判成 translate_only；必須用 analyze_sentence，至少提供一個 sentence 候選，並在 relatedCandidates 放可拆出的高品質語塊。',
      '輸出必須符合 JSON schema，不要輸出 schema 以外欄位。',
      intentPolicy,
      '',
      `使用者單字卡總數：${context.vocabularySummary.totalCards}`,
      `單字卡樣本：${JSON.stringify(vocabularyCards)}`,
      `與本次輸入相關的單字卡：${JSON.stringify(searchedCards)}`,
      `既有收藏搜尋結果：${JSON.stringify(existingCollections)}`,
      '',
      `intentHint：${input.intentHint ?? ''}`,
      `使用者輸入：${input.message}`,
    ].join('\n');
  }

  private buildIntentPolicy(input: CollectionAiChatInput) {
    if (this.isExplicitTranslateOnlyRequest(input)) {
      return '本輪意圖判斷：使用者明確要求單純翻譯，請使用 translate_only，且 candidates 必須為空陣列。';
    }

    if (this.isPureChatPreferenceRequest(input)) {
      return '本輪意圖判斷：使用者要求純聊天或不要回傳卡片，請使用 explain_usage，且 candidates 和 suggestedCards 必須為空陣列。請在 message 確認接下來會維持純聊天，直到使用者明確要求「怎麼說、我想說、拆語塊、收藏、整理可收藏內容、給我可用句子」。';
    }

    if (
      this.matchesIntent(
        input,
        /修正|改正|糾正|更自然|這句對嗎|文法|correct|fix|grammar|make this natural|sound natural/i,
      )
    ) {
      return '本輪意圖判斷：使用者要求修正文句，請使用 correct_sentence。若修正後的句子適合收藏，可提供 sentence 候選與 relatedCandidates；不要判成 translate_only。';
    }

    if (
      this.matchesIntent(
        input,
        /用法|怎麼用|差別|意思|解釋|usage|what does|explain/i,
      )
    ) {
      return '本輪意圖判斷：使用者要求解釋用法，請使用 explain_usage。若回答中有適合收藏的實際語塊，可提供候選；不要判成 translate_only。';
    }

    if (
      this.matchesIntent(
        input,
        /找.*收藏|搜尋.*收藏|有沒有收藏|已經收藏|search.*collection|find.*collection/i,
      )
    ) {
      return '本輪意圖判斷：使用者想搜尋既有收藏，請使用 find_existing，優先根據既有收藏搜尋結果回覆；不要為了湊數硬產新候選。';
    }

    if (this.isSpeakingPracticeScenarioRequest(input)) {
      return '本輪意圖判斷：使用者想取得口說練習情境或延續 roleplay 任務，請使用 suggest_candidates，但 candidates 和 suggestedCards 必須為空陣列。message 請提供 2 到 4 個口說情境、任務說明或下一句角色扮演提示；若是「第一個 / 開始 / 再難一點 / 換旅遊」等延續指令，請根據同一個 session 上下文延續。除非使用者明確要求「怎麼說、我想說、拆語塊、收藏、整理可收藏內容」，否則不要產生收藏候選。';
    }

    if (
      this.matchesIntent(
        input,
        /收藏|語塊|搭配詞|片語|子句|怎麼說|如何說|幫我說|我想說|可以怎麼表達|suggest|candidate/i,
      )
    ) {
      return '本輪意圖判斷：使用者想取得可收藏表達，請使用 suggest_candidates，並提供可收藏候選；不要判成 translate_only。';
    }

    return '本輪意圖判斷：使用者只貼一句中文或英文，沒有其他明確意圖，請使用 analyze_sentence。裸句子不能判成 translate_only，請產生可收藏候選。';
  }

  private isPureChatPreferenceRequest(input: CollectionAiChatInput) {
    const analyzeSentenceIntent: string = CollectionChatIntent.ANALYZE_SENTENCE;

    if (input.intentHint && input.intentHint !== analyzeSentenceIntent) {
      return false;
    }

    return /純聊天|單純聊天|只聊天|不要卡片|不用卡片|不要回傳.*卡片|不要.*收藏候選|不用.*收藏候選|不要.*candidates|no cards|no candidates|chat only|just chat/i.test(
      input.message,
    );
  }

  private isExplicitTranslateOnlyRequest(input: CollectionAiChatInput) {
    if (input.intentHint === CollectionChatIntent.TRANSLATE_ONLY) {
      return true;
    }

    return /只要?翻譯|單純翻譯|純翻譯|translate only|translation only|翻譯.*(不要|不用).*收藏|翻譯.*(不要|不用).*候選|(不要|不用).*收藏.*翻譯|(不要|不用).*候選.*翻譯/i.test(
      input.message,
    );
  }

  private isSpeakingPracticeScenarioRequest(input: CollectionAiChatInput) {
    const analyzeSentenceIntent: string = CollectionChatIntent.ANALYZE_SENTENCE;

    if (input.intentHint && input.intentHint !== analyzeSentenceIntent) {
      return false;
    }

    const message = input.message.trim();
    if (this.hasCandidateRequest(message)) {
      return false;
    }

    return (
      /口說|口語|開口|speaking|roleplay|role-play|角色扮演|情境|場景|任務|聊天主題|對話主題|conversation topic|practice scenario|scenario|練習.*對話|對話.*練習|練習.*英文|練習.*說英文/i.test(
        message,
      ) ||
      /^(好|好啊|可以|開始|開始吧|選第一個|第一個|第二個|第三個|換一個|再一個|再難一點|簡單一點|換旅遊|不要職場|換成旅遊|換成工作|加入.*情境|讓我.*道歉)[。！!？?\s]*$/i.test(
        message,
      )
    );
  }

  private hasCandidateRequest(message: string) {
    return /收藏|語塊|搭配詞|片語|子句|怎麼說|如何說|幫我說|我想說|可以怎麼表達|拆|拆解|整理.*收藏|翻譯|修正|改正|糾正|更自然|這句對嗎|文法|translate|correct|fix|grammar|candidate/i.test(
      message,
    );
  }

  private matchesIntent(input: CollectionAiChatInput, pattern: RegExp) {
    const analyzeSentenceIntent: string = CollectionChatIntent.ANALYZE_SENTENCE;

    if (input.intentHint && input.intentHint !== analyzeSentenceIntent) {
      return false;
    }

    return pattern.test(input.message);
  }

  private parseResult(
    finalResponse: string,
  ): Omit<CollectionAiChatResult, 'providerThreadId'> {
    try {
      const parsed = JSON.parse(
        finalResponse,
      ) as Partial<CollectionAiChatResult>;

      if (
        !this.isChatIntent(parsed.intent) ||
        typeof parsed.message !== 'string' ||
        !Array.isArray(parsed.candidates) ||
        !Array.isArray(parsed.suggestedCards)
      ) {
        throw new Error('Invalid Codex response shape');
      }

      return {
        intent: parsed.intent,
        message: parsed.message,
        candidates: parsed.candidates
          .filter((candidate) => this.isCandidate(candidate))
          .map((candidate) => ({
            kind: candidate.kind,
            text: candidate.text.trim(),
            meaning: candidate.meaning.trim(),
            sourceWord:
              typeof candidate.sourceWord === 'string'
                ? candidate.sourceWord.trim()
                : undefined,
            sourceCardIds: candidate.sourceCardIds ?? [],
            relatedCandidates: this.mapRelatedCandidates(candidate),
          })),
        suggestedCards: parsed.suggestedCards
          .filter(
            (card) =>
              card &&
              typeof card.id === 'string' &&
              typeof card.word === 'string',
          )
          .map((card) => ({
            id: card.id,
            word: card.word,
            meaning:
              typeof card.meaning === 'string' ? card.meaning : undefined,
          })),
      };
    } catch {
      throw new BadGatewayException({
        error: {
          code: 'CODEX_INVALID_RESPONSE',
          message: 'Codex 回覆格式無法解析',
        },
      });
    }
  }

  private mapRelatedCandidates(candidate: CollectionAiCandidate) {
    if (!Array.isArray(candidate.relatedCandidates)) {
      return [];
    }

    return candidate.relatedCandidates
      .filter((relatedCandidate) => this.isRelatedCandidate(relatedCandidate))
      .map((relatedCandidate) => ({
        type: relatedCandidate.type,
        kind: relatedCandidate.kind,
        text: relatedCandidate.text.trim(),
        meaning: relatedCandidate.meaning.trim(),
        sourceCardIds: relatedCandidate.sourceCardIds ?? [],
      }));
  }

  private async markExistingCandidates(
    userId: string,
    parsed: Omit<CollectionAiChatResult, 'providerThreadId'>,
  ): Promise<CollectionAiCandidate[]> {
    const existingItems = await this.tools.findCollectionItemsByText(
      userId,
      parsed.candidates.map((candidate) => candidate.text),
    );
    const existingKeys = new Set(
      existingItems.map(
        (item) => `${item.kind}:${this.tools.normalizeText(item.text)}`,
      ),
    );

    return parsed.candidates.map((candidate) => ({
      ...candidate,
      alreadySaved: existingKeys.has(
        `${candidate.kind.toUpperCase()}:${this.tools.normalizeText(candidate.text)}`,
      ),
    }));
  }

  private isCandidate(value: unknown): value is CollectionAiCandidate {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Partial<CollectionAiCandidate>;

    return (
      typeof candidate.text === 'string' &&
      typeof candidate.meaning === 'string' &&
      Object.values(CollectionItemKindDto).includes(
        candidate.kind as CollectionItemKindDto,
      )
    );
  }

  private isChatIntent(value: unknown): value is CollectionChatIntent {
    return (
      typeof value === 'string' &&
      Object.values(CollectionChatIntent).includes(
        value as CollectionChatIntent,
      )
    );
  }

  private isRelatedCandidate(
    value: unknown,
  ): value is NonNullable<CollectionAiCandidate['relatedCandidates']>[number] {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as NonNullable<
      CollectionAiCandidate['relatedCandidates']
    >[number];

    return (
      typeof candidate.text === 'string' &&
      typeof candidate.meaning === 'string' &&
      Object.values(CollectionRelationTypeDto).includes(candidate.type) &&
      [
        CollectionItemKindDto.COLLOCATION,
        CollectionItemKindDto.PHRASE,
        CollectionItemKindDto.CLAUSE,
      ].includes(candidate.kind)
    );
  }

  private assertCodexOauthReady() {
    if (existsSync(join(homedir(), '.codex', 'auth.json'))) {
      return;
    }

    throw new ServiceUnavailableException({
      error: {
        code: 'CODEX_LOGIN_REQUIRED',
        message: 'Codex 尚未登入，請先在本機執行 codex login',
      },
    });
  }

  private mapCodexError(error: unknown) {
    if (error instanceof ServiceUnavailableException) {
      return error;
    }

    if (error instanceof BadGatewayException) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);

    console.error('[CodexCollectionAiProvider] Codex execution failed', {
      message: this.truncateErrorMessage(message),
    });

    if (/aborted|abort|timeout/i.test(message)) {
      return new GatewayTimeoutException({
        error: {
          code: 'CODEX_TIMEOUT',
          message: 'Codex 執行逾時，請稍後再試',
        },
      });
    }

    if (/auth|login|oauth|unauthorized|not logged in/i.test(message)) {
      return new ServiceUnavailableException({
        error: {
          code: 'CODEX_LOGIN_REQUIRED',
          message: 'Codex OAuth 狀態不可用，請重新執行 codex login',
        },
      });
    }

    if (
      /invalid_json_schema|Invalid schema for response_format/i.test(message)
    ) {
      return new BadGatewayException({
        error: {
          code: 'CODEX_INVALID_SCHEMA',
          message: 'Codex output schema 設定不符合 structured output 規範',
        },
      });
    }

    if (
      /cannot access session files|permission denied|readonly database|operation not permitted|failed to create session|state db/i.test(
        message,
      )
    ) {
      return new ServiceUnavailableException({
        error: {
          code: 'CODEX_SESSION_ACCESS_DENIED',
          message:
            'Codex 無法存取本機 session 檔案，請確認 API 程序有權限讀寫 ~/.codex，或從一般終端機重新啟動後端',
        },
      });
    }

    if (/could not resolve host|network|error sending request/i.test(message)) {
      return new BadGatewayException({
        error: {
          code: 'CODEX_NETWORK_ERROR',
          message: 'Codex 連線失敗，請確認目前網路可連到 Codex 服務',
        },
      });
    }

    return new BadGatewayException({
      error: {
        code: 'CODEX_EXECUTION_FAILED',
        message: 'Codex 執行失敗',
      },
    });
  }

  private truncateErrorMessage(message: string) {
    const maxLength = 4000;

    return message.length > maxLength
      ? `${message.slice(0, maxLength)}...`
      : message;
  }
}
