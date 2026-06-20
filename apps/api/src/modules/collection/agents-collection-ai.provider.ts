import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Agent, run, tool, type JsonSchemaDefinition } from '@openai/agents';
import { randomUUID } from 'node:crypto';
import { mkdir, appendFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';

import {
  CollectionAiCandidate,
  CollectionAiCard,
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
const DEFAULT_DEBUG_LOG_PATH = join(
  process.cwd(),
  'logs',
  'collection-chat-debug.log',
);
const MODEL_REASONING_EFFORTS = [
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
] as const;

type ModelReasoningEffort = (typeof MODEL_REASONING_EFFORTS)[number];

const COLLECTION_AGENT_OUTPUT_SCHEMA: JsonSchemaDefinition = {
  type: 'json_schema',
  name: 'collection_agent_output',
  strict: true,
  schema: {
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
            front: { type: 'string' },
            meanings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  zhMeaning: { type: 'string' },
                  enExample: { type: ['string', 'null'] },
                  zhExample: { type: ['string', 'null'] },
                },
                required: ['zhMeaning', 'enExample', 'zhExample'],
                additionalProperties: false,
              },
            },
            reason: { type: 'string' },
            existingCardId: { type: ['string', 'null'] },
            added: { type: 'boolean' },
          },
          required: [
            'id',
            'front',
            'meanings',
            'reason',
            'existingCardId',
            'added',
          ],
          additionalProperties: false,
        },
      },
    },
    required: ['intent', 'message', 'candidates', 'suggestedCards'],
    additionalProperties: false,
  },
} as const;

@Injectable()
export class AgentsCollectionAiProvider extends CollectionAiProvider {
  private readonly model: string;
  private readonly modelReasoningEffort: ModelReasoningEffort;
  private readonly timeoutMs: number;
  private readonly debugLogEnabled: boolean;
  private readonly debugLogPath: string;

  constructor(
    private readonly tools: CollectionToolService,
    configService: ConfigService,
  ) {
    super();
    this.model =
      configService.get<string>('COLLECTION_AGENTS_MODEL') ?? DEFAULT_MODEL;
    this.modelReasoningEffort = this.parseModelReasoningEffort(
      configService.get<string>('COLLECTION_AGENTS_REASONING_EFFORT'),
    );
    this.timeoutMs =
      Number(configService.get<string>('COLLECTION_AGENTS_TIMEOUT_MS')) ||
      DEFAULT_TIMEOUT_MS;
    this.debugLogEnabled =
      process.env.NODE_ENV !== 'test' &&
      configService.get<string>('COLLECTION_CHAT_DEBUG_LOG_ENABLED') !==
        'false';
    this.debugLogPath =
      configService.get<string>('COLLECTION_CHAT_DEBUG_LOG_PATH') ??
      DEFAULT_DEBUG_LOG_PATH;
  }

  async runChat(input: CollectionAiChatInput): Promise<CollectionAiChatResult> {
    this.assertOpenAiApiKeyReady();

    const runId = randomUUID();
    const prompt = this.buildPrompt(input);
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.timeoutMs);

    try {
      await this.writeDebugLog({
        event: 'run_start',
        runId,
        userId: input.userId,
        sessionId: input.sessionId,
        providerThreadId: input.providerThreadId ?? null,
        intentHint: input.intentHint ?? null,
        model: this.model,
        modelReasoningEffort: this.modelReasoningEffort,
        prompt,
        userMessage: input.message,
      });

      const result = await run(this.createAgent(input.userId, runId), prompt, {
        previousResponseId: input.providerThreadId ?? undefined,
        signal: abortController.signal,
      });
      const parsed = this.parseResult(result.finalOutput);

      await this.writeDebugLog({
        event: 'agent_final_output',
        runId,
        userId: input.userId,
        sessionId: input.sessionId,
        lastResponseId: result.lastResponseId ?? null,
        finalOutput: result.finalOutput,
        parsed,
      });

      const relatedCards = await this.findCardsForParsedResult(
        input.userId,
        input.message,
        parsed,
      );
      const cleanParsed = this.removeLowValueSourceCardIds(
        parsed,
        relatedCards,
      );
      const candidates = await this.markExistingCandidates(
        input.userId,
        cleanParsed,
      );
      const suggestedCards = this.filterSuggestedCards(
        cleanParsed.suggestedCards,
        relatedCards,
      );
      const shouldReturnSuggestions =
        parsed.intent !== CollectionChatIntent.TRANSLATE_ONLY;
      const chatResult = {
        providerThreadId: result.lastResponseId ?? input.providerThreadId,
        intent: parsed.intent,
        message: parsed.message,
        candidates: shouldReturnSuggestions ? candidates : [],
        suggestedCards: shouldReturnSuggestions ? suggestedCards : [],
      };

      await this.writeDebugLog({
        event: 'run_complete',
        runId,
        userId: input.userId,
        sessionId: input.sessionId,
        relatedCards: this.mapCardsForAgent(relatedCards),
        cleanParsed,
        result: chatResult,
      });

      return chatResult;
    } catch (error) {
      await this.writeDebugLog({
        event: 'run_error',
        runId,
        userId: input.userId,
        sessionId: input.sessionId,
        error: this.serializeError(error),
      });

      throw this.mapAgentsError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  private createAgentConfig(userId?: string, runId?: string) {
    return {
      name: 'FlashMind Collection Pack Assistant',
      instructions:
        '你是 FlashMind 收藏包的英文學習助理。請使用可用工具查詢使用者單字卡與既有收藏，再輸出符合 JSON schema 的結果。',
      model: this.model,
      modelSettings: {
        reasoning: {
          effort: this.modelReasoningEffort,
        },
      },
      tools: userId && runId ? this.createCollectionTools(userId, runId) : [],
      outputType: COLLECTION_AGENT_OUTPUT_SCHEMA,
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

  private createAgent(
    userId: string,
    runId: string,
  ): Agent<unknown, JsonSchemaDefinition> {
    return new Agent(this.createAgentConfig(userId, runId));
  }

  private createCollectionTools(userId: string, runId: string) {
    return [
      tool({
        name: 'getUserVocabularySummary',
        description:
          '取得使用者目前單字卡總數與近期單字卡樣本。需要理解使用者已學內容或避免建議已學單字時使用。',
        parameters: z.object({
          limit: z.number().int().min(1).max(80),
        }),
        execute: async ({ limit }) => {
          await this.writeToolDebugLog(
            runId,
            userId,
            'getUserVocabularySummary',
            { limit },
          );

          const summary = await this.tools.getUserVocabularySummary(
            userId,
            limit,
          );
          const output = {
            totalCards: summary.totalCards,
            sampleCards: this.mapCardsForAgent(summary.sampleCards),
          };

          await this.writeToolDebugLog(
            runId,
            userId,
            'getUserVocabularySummary',
            { limit },
            output,
          );

          return JSON.stringify(output);
        },
        errorFunction: async (_context, error) => {
          await this.writeDebugLog({
            event: 'tool_error',
            runId,
            userId,
            toolName: 'getUserVocabularySummary',
            error: this.serializeError(error),
          });

          return '無法取得使用者單字卡摘要';
        },
      }),
      tool({
        name: 'searchUserCards',
        description:
          '依使用者輸入或候選英文單字搜尋使用者既有單字卡。產生 sourceCardIds 或 suggestedCards 前必須使用。',
        parameters: z.object({
          query: z.string(),
          limit: z.number().int().min(1).max(50),
        }),
        execute: async ({ query, limit }) => {
          await this.writeToolDebugLog(runId, userId, 'searchUserCards', {
            query,
            limit,
          });

          const cards = await this.tools.searchUserCards(userId, query, limit);
          const output = this.mapCardsForAgent(cards);

          await this.writeToolDebugLog(
            runId,
            userId,
            'searchUserCards',
            { query, limit },
            output,
          );

          return JSON.stringify(output);
        },
        errorFunction: async (_context, error) => {
          await this.writeDebugLog({
            event: 'tool_error',
            runId,
            userId,
            toolName: 'searchUserCards',
            error: this.serializeError(error),
          });

          return '無法搜尋使用者單字卡';
        },
      }),
      tool({
        name: 'searchCollectionItems',
        description:
          '依使用者輸入搜尋已存在的收藏句子、搭配詞、片語或子句。判斷是否已收藏或回覆 find_existing 意圖時使用。',
        parameters: z.object({
          query: z.string(),
          limit: z.number().int().min(1).max(50),
        }),
        execute: async ({ query, limit }) => {
          await this.writeToolDebugLog(runId, userId, 'searchCollectionItems', {
            query,
            limit,
          });

          const items = await this.tools.searchCollectionItems(
            userId,
            query,
            limit,
          );
          const output = this.mapCollectionsForAgent(items);

          await this.writeToolDebugLog(
            runId,
            userId,
            'searchCollectionItems',
            { query, limit },
            output,
          );

          return JSON.stringify(output);
        },
        errorFunction: async (_context, error) => {
          await this.writeDebugLog({
            event: 'tool_error',
            runId,
            userId,
            toolName: 'searchCollectionItems',
            error: this.serializeError(error),
          });

          return '無法搜尋既有收藏';
        },
      }),
    ];
  }

  private mapCardsForAgent(
    cards: Awaited<ReturnType<CollectionToolService['searchUserCards']>>,
  ) {
    return cards.map((card) => ({
      id: card.id,
      word: card.front,
      meaning: card.meanings[0]?.zhMeaning ?? '',
    }));
  }

  private mapCollectionsForAgent(
    items: Awaited<ReturnType<CollectionToolService['searchCollectionItems']>>,
  ) {
    return items.map((item) => ({
      id: item.id,
      kind: item.kind.toLowerCase(),
      text: item.text,
      meaning: item.zhMeaning ?? '',
      sourceWords: item.cardLinks.map((link) => link.card.front),
    }));
  }

  private buildPrompt(input: CollectionAiChatInput) {
    const intentPolicy = this.buildIntentPolicy(input);

    return [
      '你是 FlashMind「用我的單字庫造句」助理。',
      '核心任務：使用者會輸入一個中文句子；你要先查使用者目前單字卡，優先用他已經學過的英文單字組成自然英文句子，並建議缺少但值得新增的核心單字。',
      'message 請簡短說明你用了哪些已學單字、哪些字建議新增；不要把 candidates 逐字重複列成清單。',
      '工具使用規則：你可以呼叫 getUserVocabularySummary、searchUserCards、searchCollectionItems 查詢使用者資料；不要假設你已知道使用者有哪些單字卡或收藏。',
      '產生句子前，請先呼叫 getUserVocabularySummary({ limit: 24 }) 與 searchUserCards({ query: 使用者輸入或你準備使用的英文關鍵字, limit: 20 })。',
      '造句規則：優先選用使用者單字卡中已存在的內容字；英文句子必須自然，不要為了硬塞單字產生奇怪英文。若自然句子需要使用單字庫沒有的核心名詞、動詞或形容詞，請使用它，並放入 suggestedCards。',
      '只可根據後端提供的使用者單字卡 id 產生 sourceCardIds；不可捏造 card id。sentence candidate 的 sourceCardIds 放入本句實際使用到的已學內容字卡片 id。',
      'suggestedCards 規則：只放「完成這句自然英文真的需要、值得學、且使用者單字卡中找不到」的核心單字或短片語。不可為了湊數建議冠詞、介系詞、代名詞、be 動詞、助動詞等功能字，也不可建議已出現在單字卡樣本或相關單字卡中的字。',
      '中文造句缺字規則：即使缺少的英文單字沒有出現在使用者中文原文，只要它是自然英文句子的核心字且使用者卡片找不到，就應放入 suggestedCards。例如「不要醬」可產生 No sauce, please.；若 sauce 不在既有卡片，suggestedCards 應包含 front=sauce、zhMeaning=醬。',
      '缺字候選一致性規則：如果 message、sentence candidate 或 relatedCandidates 中出現使用者卡片找不到的核心名詞、動詞或形容詞，suggestedCards 不可為空；請加入最核心的 1 到 3 個缺字。',
      'sourceCardIds 品質規則：sourceCardIds 只連結真正支撐語意的已學內容字，不要連結 no、please、could、would、can、have、without、I、you、the 等功能字、禮貌詞、代名詞或助動詞。',
      'suggestedCards 必須使用可直接建立快閃卡的資料：front 是單字或短片語；meanings 至少一筆，且每筆包含 zhMeaning、enExample、zhExample；reason 用一句中文說明為什麼此字值得新增；existingCardId 若不存在請填 null；added 一律填 false。',
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
      '本功能不做一般聊天、roleplay 或泛用用法解釋；遇到這類輸入，也請把它改寫成一個可練習的中文意圖並提供英文句子候選。',
      '如果使用者只貼一句中文或英文，沒有明確要求只翻譯，裸句子不能判成 translate_only；必須用 suggest_candidates，至少提供一個 sentence 候選。',
      '輸出必須符合 JSON schema，不要輸出 schema 以外欄位。',
      intentPolicy,
      '',
      `intentHint：${input.intentHint ?? ''}`,
      `使用者輸入：${input.message}`,
    ].join('\n');
  }

  private buildIntentPolicy(input: CollectionAiChatInput) {
    if (this.isExplicitTranslateOnlyRequest(input)) {
      return '本輪意圖判斷：使用者明確要求單純翻譯，請使用 translate_only，且 candidates 與 suggestedCards 必須為空陣列。';
    }

    if (
      this.matchesIntent(
        input,
        /找.*收藏|搜尋.*收藏|有沒有收藏|已經收藏|search.*collection|find.*collection/i,
      )
    ) {
      return '本輪意圖判斷：使用者想搜尋既有收藏，請使用 find_existing，優先根據既有收藏搜尋結果回覆；不要為了湊數硬產新候選。';
    }

    return '本輪意圖判斷：請使用 suggest_candidates，把使用者輸入視為要用既有單字庫造英文句子的中文意圖；至少提供一個 sentence 候選，並列出需要新增的核心單字。';
  }

  private isExplicitTranslateOnlyRequest(input: CollectionAiChatInput) {
    if (input.intentHint === CollectionChatIntent.TRANSLATE_ONLY) {
      return true;
    }

    return /只要?翻譯|單純翻譯|純翻譯|translate only|translation only|翻譯.*(不要|不用).*收藏|翻譯.*(不要|不用).*候選|(不要|不用).*收藏.*翻譯|(不要|不用).*候選.*翻譯/i.test(
      input.message,
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
    finalOutput: unknown,
  ): Omit<CollectionAiChatResult, 'providerThreadId'> {
    try {
      const parsed =
        typeof finalOutput === 'string'
          ? (JSON.parse(finalOutput) as Partial<CollectionAiChatResult>)
          : (finalOutput as Partial<CollectionAiChatResult>);

      if (
        !this.isChatIntent(parsed.intent) ||
        typeof parsed.message !== 'string' ||
        !Array.isArray(parsed.candidates) ||
        !Array.isArray(parsed.suggestedCards)
      ) {
        throw new Error('Invalid Agents SDK response shape');
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
              typeof card.front === 'string' &&
              Array.isArray(card.meanings) &&
              typeof card.reason === 'string',
          )
          .map((card) => this.mapSuggestedCard(card))
          .filter((card): card is CollectionAiCard => Boolean(card)),
      };
    } catch {
      throw new BadGatewayException({
        error: {
          code: 'AGENTS_INVALID_RESPONSE',
          message: 'Agents SDK 回覆格式無法解析',
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

  private async findCardsForParsedResult(
    userId: string,
    userMessage: string,
    parsed: Omit<CollectionAiChatResult, 'providerThreadId'>,
  ) {
    const lookupTexts = this.collectCardLookupTexts(userMessage, parsed);

    if (lookupTexts.length === 0) {
      return [];
    }

    return this.tools.findUserCardsByCandidateTexts(userId, lookupTexts, 120);
  }

  private collectCardLookupTexts(
    userMessage: string,
    parsed: Omit<CollectionAiChatResult, 'providerThreadId'>,
  ): string[] {
    return [
      ...new Set(
        [
          userMessage,
          ...parsed.candidates.flatMap((candidate) => [
            candidate.text,
            candidate.meaning,
            candidate.sourceWord ?? '',
            ...(candidate.relatedCandidates ?? []).flatMap(
              (relatedCandidate) => [
                relatedCandidate.text,
                relatedCandidate.meaning,
              ],
            ),
          ]),
          ...parsed.suggestedCards.flatMap((card) => [
            card.front,
            card.reason,
            ...card.meanings.flatMap((meaning) => [
              meaning.zhMeaning,
              meaning.enExample ?? '',
              meaning.zhExample ?? '',
            ]),
          ]),
        ]
          .map((text) => text.trim())
          .filter((text) => text.length > 0),
      ),
    ];
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

  private mapSuggestedCard(
    card: Partial<CollectionAiCard>,
  ): CollectionAiCard | null {
    const meanings = (card.meanings ?? [])
      .filter(
        (meaning) =>
          meaning &&
          typeof meaning.zhMeaning === 'string' &&
          meaning.zhMeaning.trim().length > 0,
      )
      .map((meaning) => {
        const mappedMeaning: CollectionAiCard['meanings'][number] = {
          zhMeaning: meaning.zhMeaning.trim(),
        };

        if (typeof meaning.enExample === 'string' && meaning.enExample.trim()) {
          mappedMeaning.enExample = meaning.enExample.trim();
        }

        if (typeof meaning.zhExample === 'string' && meaning.zhExample.trim()) {
          mappedMeaning.zhExample = meaning.zhExample.trim();
        }

        return mappedMeaning;
      });

    if (
      typeof card.id !== 'string' ||
      typeof card.front !== 'string' ||
      typeof card.reason !== 'string' ||
      !card.front.trim() ||
      !card.reason.trim() ||
      meanings.length === 0
    ) {
      return null;
    }

    return {
      id: card.id.trim() || this.createSuggestedCardFallbackId(card.front),
      front: card.front.trim(),
      meanings,
      reason: card.reason.trim(),
      existingCardId:
        typeof card.existingCardId === 'string' && card.existingCardId.trim()
          ? card.existingCardId.trim()
          : null,
      added: Boolean(card.added),
    };
  }

  private createSuggestedCardFallbackId(front: string): string {
    return `suggested-${this.tools
      .normalizeText(front)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')}`;
  }

  private filterSuggestedCards(
    suggestedCards: CollectionAiCard[],
    existingCards: Array<{ id: string; front: string }>,
  ): CollectionAiCard[] {
    const existingByFront = new Map(
      existingCards.map((card) => [
        this.tools.normalizeText(card.front),
        card.id,
      ]),
    );

    return suggestedCards
      .map((card) => {
        const existingCardId =
          card.existingCardId ??
          existingByFront.get(this.tools.normalizeText(card.front)) ??
          null;

        return { ...card, existingCardId };
      })
      .filter((card) => !card.existingCardId);
  }

  private removeLowValueSourceCardIds(
    parsed: Omit<CollectionAiChatResult, 'providerThreadId'>,
    existingCards: Array<{ id: string; front: string }>,
  ): Omit<CollectionAiChatResult, 'providerThreadId'> {
    const lowValueCardIds = new Set(
      existingCards
        .filter((card) => this.isLowValueSourceWord(card.front))
        .map((card) => card.id),
    );

    if (lowValueCardIds.size === 0) {
      return parsed;
    }

    return {
      ...parsed,
      candidates: parsed.candidates.map((candidate) => ({
        ...candidate,
        sourceCardIds: (candidate.sourceCardIds ?? []).filter(
          (cardId) => !lowValueCardIds.has(cardId),
        ),
        relatedCandidates: (candidate.relatedCandidates ?? []).map(
          (relatedCandidate) => ({
            ...relatedCandidate,
            sourceCardIds: (relatedCandidate.sourceCardIds ?? []).filter(
              (cardId) => !lowValueCardIds.has(cardId),
            ),
          }),
        ),
      })),
    };
  }

  private isLowValueSourceWord(front: string): boolean {
    return new Set([
      'a',
      'an',
      'am',
      'are',
      'be',
      'been',
      'being',
      'can',
      'could',
      'did',
      'do',
      'does',
      'had',
      'has',
      'have',
      'he',
      'her',
      'him',
      'i',
      'is',
      'it',
      'may',
      'might',
      'no',
      'not',
      'of',
      'please',
      'she',
      'that',
      'the',
      'they',
      'this',
      'to',
      'was',
      'we',
      'were',
      'will',
      'with',
      'without',
      'would',
      'you',
    ]).has(this.tools.normalizeText(front));
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

  private assertOpenAiApiKeyReady() {
    if (process.env.OPENAI_API_KEY) {
      return;
    }

    throw new ServiceUnavailableException({
      error: {
        code: 'OPENAI_API_KEY_REQUIRED',
        message: 'OpenAI API key 尚未設定，請先設定 OPENAI_API_KEY',
      },
    });
  }

  private mapAgentsError(error: unknown) {
    if (error instanceof ServiceUnavailableException) {
      return error;
    }

    if (error instanceof BadGatewayException) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);

    console.error('[AgentsCollectionAiProvider] Agents SDK execution failed', {
      message: this.truncateErrorMessage(message),
    });

    if (/aborted|abort|timeout/i.test(message)) {
      return new GatewayTimeoutException({
        error: {
          code: 'AGENTS_TIMEOUT',
          message: 'Agents SDK 執行逾時，請稍後再試',
        },
      });
    }

    if (/auth|api key|unauthorized|permission|401/i.test(message)) {
      return new ServiceUnavailableException({
        error: {
          code: 'OPENAI_API_KEY_REQUIRED',
          message: 'OpenAI API key 不可用，請確認 OPENAI_API_KEY 設定',
        },
      });
    }

    if (
      /invalid_json_schema|Invalid schema for response_format|schema/i.test(
        message,
      )
    ) {
      return new BadGatewayException({
        error: {
          code: 'AGENTS_INVALID_SCHEMA',
          message: 'Agents SDK output schema 設定不符合 structured output 規範',
        },
      });
    }

    if (/could not resolve host|network|error sending request/i.test(message)) {
      return new BadGatewayException({
        error: {
          code: 'AGENTS_NETWORK_ERROR',
          message: 'Agents SDK 連線失敗，請確認目前網路可連到 OpenAI 服務',
        },
      });
    }

    return new BadGatewayException({
      error: {
        code: 'AGENTS_EXECUTION_FAILED',
        message: 'Agents SDK 執行失敗',
      },
    });
  }

  private async writeToolDebugLog(
    runId: string,
    userId: string,
    toolName: string,
    input: unknown,
    output?: unknown,
  ) {
    await this.writeDebugLog({
      event: output === undefined ? 'tool_call' : 'tool_result',
      runId,
      userId,
      toolName,
      input,
      output,
    });
  }

  private async writeDebugLog(entry: Record<string, unknown>) {
    if (!this.debugLogEnabled) {
      return;
    }

    try {
      await mkdir(dirname(this.debugLogPath), { recursive: true });
      await appendFile(
        this.debugLogPath,
        `${JSON.stringify({
          timestamp: new Date().toISOString(),
          ...entry,
        })}\n`,
        'utf8',
      );
    } catch (error) {
      console.error('[AgentsCollectionAiProvider] Failed to write debug log', {
        message: this.truncateErrorMessage(
          error instanceof Error ? error.message : String(error),
        ),
      });
    }
  }

  private serializeError(error: unknown) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: this.truncateErrorMessage(error.message),
        stack: error.stack ? this.truncateErrorMessage(error.stack) : undefined,
      };
    }

    return {
      message: this.truncateErrorMessage(String(error)),
    };
  }

  private truncateErrorMessage(message: string) {
    const maxLength = 4000;

    return message.length > maxLength
      ? `${message.slice(0, maxLength)}...`
      : message;
  }
}
