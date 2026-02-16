import {
  SpeakingVoice,
  SpeakingChatHistoryItem,
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

export interface SpeakingSettings {
  autoPlayVoice: boolean;
  showTranscript: boolean;
  autoTranslate: boolean;
  systemPrompt: string;
  voice: SpeakingVoice;
  memory: string;
  autoMemoryEnabled: boolean;
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

export const SPEAKING_HISTORY_LIMIT_BYTES = 200 * 1024 * 1024;

export const SPEAKING_DEFAULT_SETTINGS: SpeakingSettings = {
  autoPlayVoice: true,
  showTranscript: true,
  autoTranslate: false,
  systemPrompt: '',
  voice: SpeakingVoice.Nova,
  memory: '',
  autoMemoryEnabled: true,
};

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

    const text = message.text?.trim();
    if (text) {
      history.push({
        role: SpeakingChatHistoryItem.RoleEnum.User,
        text,
      });
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
