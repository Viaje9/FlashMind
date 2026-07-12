import {
  TopicConversationCorrectionStatus,
  type TopicConversationCorrection,
  type TopicConversationMessage,
  type TopicConversationRole,
  type TopicConversationSessionDetail,
  type TopicConversationSessionSummary,
  type TopicConversationTopic,
} from '@flashmind/api-client';

export type TopicConversationCorrectionTone = 'success' | 'info' | 'warning';

export interface TopicConversationCorrectionView {
  status: TopicConversationCorrectionStatus;
  label: string;
  tone: TopicConversationCorrectionTone;
  showDetails: boolean;
  suggestedText: string | null;
  explanation: string | null;
}

export interface TopicConversationMessageView {
  id: string;
  role: TopicConversationRole;
  content: string;
  correction: TopicConversationCorrectionView | null;
  createdAt: string;
  streaming: boolean;
}

export interface TopicConversationSessionView {
  id: string;
  topic: TopicConversationTopic;
  messages: TopicConversationMessageView[];
  createdAt: string;
  updatedAt: string;
}

export interface TopicConversationHistoryItem {
  id: string;
  topicId: string;
  title: string;
  scenario: string;
  messageCount: number;
  preview: string;
  createdAt: string;
  updatedAt: string;
}

const CORRECTION_PRESENTATION: Record<
  TopicConversationCorrectionStatus,
  Pick<TopicConversationCorrectionView, 'label' | 'tone'>
> = {
  [TopicConversationCorrectionStatus.Correct]: {
    label: '這句很自然',
    tone: 'success',
  },
  [TopicConversationCorrectionStatus.Improved]: {
    label: '更自然的說法',
    tone: 'info',
  },
  [TopicConversationCorrectionStatus.Corrected]: {
    label: '建議修正',
    tone: 'warning',
  },
};

export function mapTopicConversationCorrection(
  correction: TopicConversationCorrection | null | undefined,
): TopicConversationCorrectionView | null {
  if (!correction) {
    return null;
  }

  const presentation = CORRECTION_PRESENTATION[correction.status];
  const isCorrect = correction.status === TopicConversationCorrectionStatus.Correct;
  const suggestedText = isCorrect ? null : normalizeOptionalText(correction.suggestedText);
  const explanation = isCorrect ? null : normalizeOptionalText(correction.explanation);

  return {
    status: correction.status,
    ...presentation,
    showDetails: !isCorrect && !!(suggestedText || explanation),
    suggestedText,
    explanation,
  };
}

export function mapTopicConversationMessage(
  message: TopicConversationMessage,
): TopicConversationMessageView {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    correction: mapTopicConversationCorrection(message.correction),
    createdAt: message.createdAt,
    streaming: false,
  };
}

export function mapTopicConversationSession(
  session: TopicConversationSessionDetail,
): TopicConversationSessionView {
  return {
    id: session.id,
    topic: { ...session.topic },
    messages: session.messages.map(mapTopicConversationMessage),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export function mapTopicConversationHistoryItem(
  session: TopicConversationSessionSummary,
): TopicConversationHistoryItem {
  const preview = session.lastMessagePreview.trim() || `共 ${session.messageCount} 則訊息`;

  return {
    id: session.id,
    topicId: session.topic.id,
    title: session.topic.title,
    scenario: session.topic.scenario,
    messageCount: session.messageCount,
    preview,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export function canSendTopicConversationMessage(message: string, sending: boolean): boolean {
  const normalized = message.trim();
  return !sending && normalized.length > 0 && normalized.length <= 4000;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
}
