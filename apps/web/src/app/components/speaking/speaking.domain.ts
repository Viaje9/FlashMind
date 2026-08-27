import {
  SpeakingVoice,
  SpeakingChatHistoryItem,
  type SpeakingNextPractice,
  type SpeakingSummaryResult,
  type SpeakingTokenUsage,
} from '@flashmind/api-client';

export type SpeakingRole = 'user' | 'assistant' | 'summary';
export type SpeakingAssistantRole = 'user' | 'assistant';

export interface SpeakingMessage {
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
  autoPlayVoice: boolean;
  showTranscript: boolean;
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
- Do not ask a question on every turn; ask at most one natural question only when it genuinely helps
- Avoid consecutive follow-up questions or turning the conversation into an interview
- Let the conversation naturally continue, pause on a topic, or change direction

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
- After helping, return directly to the original conversation; do not expand into a mini-lesson unless asked again

Private practice context:
- Topics, goals, guiding questions, and recall words are quiet background context, not a checklist
- Never quiz, hint at, list, or force target words, and never create artificial opportunities to use them
- Follow the user's real direction. If they change topic, do not pull them back

Ending:
- Only treat the session as finished when the user's whole message is a clear ending instruction
- Then briefly acknowledge the ending and do not ask another question`;

export const SPEAKING_DEFAULT_SETTINGS: SpeakingSettings = {
  autoPlayVoice: true,
  showTranscript: true,
  autoTranslate: false,
  systemPrompt: '',
  voice: SpeakingVoice.Marin,
  memory: '',
  autoMemoryEnabled: true,
  lastPractice: undefined,
  nextPractice: undefined,
};

export function formatSpeakingReviewSummary(
  result: Pick<
    SpeakingSummaryResult,
    'summary' | 'review' | 'actualUses' | 'recommendations' | 'nextPractice'
  >,
): string {
  const sections: string[] = [];
  const summary = result.summary.trim();
  const review = result.review.trim();

  if (summary) sections.push(summary);
  if (review) sections.push(`練習回顧\n${review}`);
  if (result.actualUses.length > 0) {
    sections.push(
      `這次實際使用\n${result.actualUses
        .map((item) => `• ${item.term}（${item.zhMeaning}）`)
        .join('\n')}`,
    );
  }
  if (result.recommendations.length > 0) {
    sections.push(
      `下次可以試試\n${result.recommendations
        .map((item) => `• ${item.term}（${item.zhMeaning}）`)
        .join('\n')}`,
    );
  }
  if (result.nextPractice.topic.trim()) {
    sections.push(`下次主題\n${result.nextPractice.topic.trim()}`);
  }

  return sections.join('\n\n');
}

export interface SpeakingReviewSummaryView {
  summary: string;
  review: string;
  actualUses: string[];
  recommendations: string[];
  nextTopic: string;
}

export function parseSpeakingReviewSummary(text: string): SpeakingReviewSummaryView {
  type Section = 'summary' | 'review' | 'actualUses' | 'recommendations' | 'nextTopic';

  const view: SpeakingReviewSummaryView = {
    summary: '',
    review: '',
    actualUses: [],
    recommendations: [],
    nextTopic: '',
  };
  const textSections: Record<'summary' | 'review' | 'nextTopic', string[]> = {
    summary: [],
    review: [],
    nextTopic: [],
  };
  const headingSections: Record<string, Section> = {
    練習回顧: 'review',
    這次實際使用: 'actualUses',
    下次可以試試: 'recommendations',
    下次主題: 'nextTopic',
  };
  let section: Section = 'summary';

  for (const line of text.replaceAll('\r\n', '\n').split('\n')) {
    const trimmed = line.trim();
    const nextSection = headingSections[trimmed];
    if (nextSection) {
      section = nextSection;
      continue;
    }

    if (section === 'actualUses' || section === 'recommendations') {
      if (trimmed) view[section].push(trimmed.replace(/^•\s*/, ''));
      continue;
    }

    textSections[section].push(line);
  }

  view.summary = textSections.summary.join('\n').trim();
  view.review = textSections.review.join('\n').trim();
  view.nextTopic = textSections.nextTopic.join('\n').trim();
  return view;
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
