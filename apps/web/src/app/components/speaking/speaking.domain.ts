import {
  SpeakingVoice,
  SpeakingChatHistoryItem,
  type SpeakingNextPractice,
  type SpeakingSummaryResult,
  type SpeakingTokenUsage,
} from '@flashmind/api-client';

export type SpeakingRole = 'user' | 'assistant' | 'summary';
export type SpeakingAssistantRole = 'user' | 'assistant';
export type SpeakingInteractionMode = 'TURN_BASED' | 'REALTIME' | 'FULL_DUPLEX';

export interface SpeakingMessage {
  hasOriginalAudio?: boolean;
  transcriptStatus?: 'available' | 'unavailable';
  id: string;
  conversationId: string;
  role: SpeakingRole;
  text?: string;
  translatedText?: string;
  audioBlobKey?: string;
  audioMimeType?: string;
  audioBase64?: string;
  createdAt: string;
  usage?: SpeakingTokenUsage;
  transcriptionDurationSeconds?: number;
}

export interface SpeakingConversation {
  startedAt?: string;
  endedAt?: string | null;
  ownerId?: string;
  source?: 'APP' | 'LOCAL';
  reviewed?: boolean;
  remoteId?: string;
  remoteRevision?: number;
  syncedMessageIds?: string[];
  remoteCreate?: import('@flashmind/shared').SpeakingSessionCreate;
  pendingReview?: import('@flashmind/shared').SpeakingReviewDraft;
  pendingAnalysis?: SpeakingSummaryResult;
  syncPending?: boolean;
  migratedTo?: Record<string, string>;
  migrationDrafts?: Record<string, import('@flashmind/shared').SpeakingLegacySession>;
  review?: import('@flashmind/shared').SpeakingRecordedResult;
  id: string;
  title: string;
  summary?: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  lastMessageText?: string;
}

export interface SpeakingAssistantMessage {
  id: string;
  role: SpeakingAssistantRole;
  content: string;
  createdAt: string;
}

export interface SpeakingLastPractice {
  title: string;
  summary: string;
}

export interface SpeakingSettings {
  interactionMode: SpeakingInteractionMode;
  autoPlayVoice: boolean;
  showTranscript: boolean;
  showCost: boolean;
  autoTranslate: boolean;
  systemPrompt: string;
  voice: SpeakingVoice;
  memory: string;
  autoMemoryEnabled: boolean;
  lastPractice?: SpeakingLastPractice;
  nextPractice?: SpeakingNextPractice;
}

export interface SpeakingStoreState {
  conversationId: string | null;
  messages: SpeakingMessage[];
  sending: boolean;
  summarizing: boolean;
  loadingConversation: boolean;
  translatingMessageId: string | null;
  assistantMessages: SpeakingAssistantMessage[];
  assistantSending: boolean;
  retryAvailable: boolean;
  error: string | null;
}

export interface SpeakingSelectionTranslationRequest {
  messageId: string;
  selectedText: string;
  requestToken: number;
}

export interface SpeakingReviewMarkedContext {
  id: string;
  messageId: string;
  selectedText: string;
  note: string | null;
}

export interface SpeakingSelectionTranslationSuccessResult {
  status: 'success';
  requestToken: number;
  translatedText: string;
  cached: boolean;
}

export interface SpeakingSelectionTranslationErrorResult {
  status: 'error';
  requestToken: number;
  errorMessage: string;
}

export type SpeakingSelectionTranslationResult =
  | SpeakingSelectionTranslationSuccessResult
  | SpeakingSelectionTranslationErrorResult;

export const SPEAKING_HISTORY_LIMIT_BYTES = 200 * 1024 * 1024;

export const SPEAKING_DEFAULT_SYSTEM_PROMPT = `You are a friendly, natural English conversation partner for a CEFR B1 learner. Talk like an ordinary conversation partner, not an English teacher.
The live session exists to keep a real conversation going. It is not a lesson, correction drill, interview, or vocabulary test. Full corrections and learning advice belong in the review after the session.

Conversation style:
- Use natural English that a B1 learner can understand
- Respond to what the user is talking about, not to the quality of their English
- You may share a brief reaction, opinion, or relevant perspective so the exchange feels like a real conversation
- Usually reply in 1-2 short sentences and keep most replies under 35 words
- Start each reply with a brief, natural response to what the user said
- End every live-conversation reply with exactly one simple, natural question that gives the user an easy way to continue
- Choose the question in this order: clarify the user's meaning; deepen the current topic; open a naturally related topic; then use the next-practice context
- Keep the question connected to the conversation and easy for a B1 learner to answer; never ask a checklist of questions or make the exchange feel like an interview

During live conversation:
- First understand and respond to the user's meaning
- If the meaning is understandable, ignore grammar mistakes, awkward wording, pronunciation issues, and transcription errors
- Do not proactively correct, rephrase, teach vocabulary, explain grammar, or evaluate the user's English
- Never say "You can say..." or "A more natural way is..." unless the user explicitly asks for language help
- Never ask the user to repeat, make another sentence, try again, or deliberately use a word
- If the meaning is truly unclear, ask one ordinary clarification question without turning it into a lesson

Language help:
- Help only when the user explicitly asks how to say something, requests a meaning, translation, spelling, grammar explanation, correction, example, or says they did not understand
- Answer only what the user actually asked, briefly and practically
- Use Traditional Chinese when the user asks for Chinese
- After helping, return directly to the original conversation and end with one natural question from that conversation; do not expand into a mini-lesson unless asked again

Private practice context:
- Topics, goals, guiding questions, and recall words are quiet background context, not a checklist
- Never quiz, hint at, list, or force target words, and never create artificial opportunities to use them
- Follow the user's real direction. If they change topic, do not pull them back

Ending:
- Only treat the session as finished when the user's whole message is a clear ending instruction
- A clear ending instruction is the only exception to the one-question rule
- Then briefly acknowledge the ending and do not ask another question`;

export const SPEAKING_DEFAULT_SETTINGS: SpeakingSettings = {
  interactionMode: 'TURN_BASED',
  autoPlayVoice: true,
  showTranscript: true,
  showCost: true,
  autoTranslate: false,
  systemPrompt: '',
  voice: SpeakingVoice.Marin,
  memory: '',
  autoMemoryEnabled: true,
  lastPractice: undefined,
  nextPractice: undefined,
};

/** Summary 直接保存可閱讀的 Markdown，不再解析舊版純文字標題。 */
export function formatSpeakingReviewSummary(
  result: Pick<
    SpeakingSummaryResult,
    'summary' | 'review' | 'actualUses' | 'recommendations' | 'nextPractice'
  >,
): string {
  const actualVocabulary = result.actualUses.length
    ? [
        '| 單字 | 意思與使用情境 | 你當時的原句 | 更自然的說法 |',
        '| --- | --- | --- | --- |',
        ...result.actualUses.map((item) => {
          const quotes = item.evidence
            ?.map((evidence) => evidence.quote)
            .filter((quote) => quote.trim())
            .join('\n\n');
          return `| ${escapeReviewCell(item.term)} | ${escapeReviewCell(item.expressionContext)} | ${quotes ? escapeReviewQuote(quotes) : '未提供原句證據'} | ${escapeReviewCell(item.naturalSentence)} |`;
        }),
      ].join('\n')
    : '本次沒有可確認的實際使用目標單字；下方建議單字不計入實際使用。';
  const vocabulary = result.recommendations.length
    ? [
        '| 單字 | 意思與使用情境 | 可練習的句子 | 推薦原因 |',
        '| --- | --- | --- | --- |',
        ...result.recommendations.map(
          (item) =>
            `| ${[item.term, item.expressionContext, item.naturalSentence, item.recommendationReason].map(escapeReviewCell).join(' | ')} |`,
        ),
      ].join('\n')
    : '本次沒有需要額外推薦的目標單字；可以先練習上面的自然說法。';
  const sections = [
    `## 可以說得更自然的地方\n\n${result.review.trim()}`,
    `## 這次實際使用的單字\n\n${actualVocabulary}`,
    `## 建議練習的單字\n\n${vocabulary}`,
    `## 可朗讀的英文摘要\n\n${result.summary.trim()}`,
  ];
  if (result.nextPractice.topic.trim()) {
    sections.push(`**下次主題：** ${escapeReviewCell(result.nextPractice.topic)}`);
  }
  return sections.join('\n\n');
}

function escapeReviewCell(value: string): string {
  return escapeReviewQuote(value.trim().replace(/\s+/g, ' '));
}

function escapeReviewQuote(value: string): string {
  return value
    .replace(/[&<>|\\`*[\]_]/g, (char) => `&#${char.charCodeAt(0)};`)
    .replace(/\r\n|\r|\n/g, '&#10;');
}

export function createSpeakingId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createConversationTitle(message: string): string {
  const normalized = message.trim();
  if (!normalized) {
    return '新對話';
  }

  return normalized.length > 24 ? `${normalized.slice(0, 24)}...` : normalized;
}

export function normalizeSelectionTranslationText(selectedText: string): string {
  return selectedText.trim();
}

export function createSelectionTranslationCacheKey(
  messageId: string,
  selectedText: string,
): string {
  const normalizedText = normalizeSelectionTranslationText(selectedText);
  return `${messageId}:${normalizedText}`;
}

export function isSelectionTranslationResultStale(
  activeRequestToken: number,
  responseRequestToken: number,
): boolean {
  return activeRequestToken !== responseRequestToken;
}

export function createConversationRecord(input: {
  id: string;
  firstMessageText?: string;
  summary?: string;
}): SpeakingConversation {
  const now = new Date().toISOString();
  return {
    id: input.id,
    title: createConversationTitle(input.firstMessageText ?? ''),
    summary: input.summary,
    messageCount: 0,
    createdAt: now,
    updatedAt: now,
    lastMessageText: input.firstMessageText,
  };
}

export function updateConversationFromMessages(
  conversation: SpeakingConversation,
  messages: SpeakingMessage[],
): SpeakingConversation {
  const sorted = [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const firstText = sorted.find((message) => message.text?.trim())?.text ?? '';
  const lastText = [...sorted].reverse().find((message) => message.text?.trim())?.text ?? '';
  const summaryText = [...sorted]
    .reverse()
    .find((message) => message.role === 'summary' && message.text?.trim())?.text;

  return {
    ...conversation,
    title: conversation.title || createConversationTitle(firstText),
    summary: summaryText || conversation.summary,
    messageCount: sorted.length,
    updatedAt: new Date().toISOString(),
    lastMessageText: lastText || conversation.lastMessageText,
  };
}

export async function toSpeakingHistory(
  messages: SpeakingMessage[],
  resolveAudioBase64: (audioBlobKey: string) => Promise<string | null>,
): Promise<SpeakingChatHistoryItem[]> {
  const history: SpeakingChatHistoryItem[] = [];

  for (const message of messages) {
    if (message.role === 'summary') {
      continue;
    }

    if (message.role === 'assistant') {
      const text = message.text?.trim();
      if (text) {
        history.push({
          role: SpeakingChatHistoryItem.RoleEnum.Assistant,
          text,
        });
      }
      continue;
    }

    const text = message.text?.trim();
    if (text) {
      history.push({
        role: SpeakingChatHistoryItem.RoleEnum.User,
        text,
      });
      continue;
    }

    let audioBase64 = message.audioBase64?.trim() || '';
    if (!audioBase64 && message.audioBlobKey) {
      audioBase64 = (await resolveAudioBase64(message.audioBlobKey)) ?? '';
    }

    if (audioBase64 && isSupportedHistoryAudioMime(message.audioMimeType)) {
      history.push({
        role: SpeakingChatHistoryItem.RoleEnum.User,
        audioBase64,
      });
      continue;
    }
  }

  return history;
}

function isSupportedHistoryAudioMime(mimeType?: string): boolean {
  if (!mimeType?.trim()) {
    return true;
  }

  const normalized = mimeType.toLowerCase();
  return normalized.includes('wav');
}
