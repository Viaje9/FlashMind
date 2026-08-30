import {
  validateReviewDraft,
  type SpeakingHistoryMessage,
  type SpeakingLegacySession,
  type SpeakingPracticeContext,
  type SpeakingReviewDraft,
  type SpeakingSessionRecord,
} from '@flashmind/shared';
import type { SpeakingSummaryResult } from '@flashmind/api-client';
import type { SpeakingConversation, SpeakingMessage } from './speaking.domain';

function cloudMessage(message: SpeakingMessage): SpeakingHistoryMessage {
  if (message.role === 'summary') throw new Error('Summary 不屬於原始對話');
  return {
    id: message.id,
    role: message.role,
    text: message.text ?? '',
    createdAt: new Date(message.createdAt).toISOString(),
    ...(message.translatedText ? { translatedText: message.translatedText } : {}),
    hasOriginalAudio: !!message.audioBlobKey || !!message.hasOriginalAudio,
    transcriptStatus: message.text?.trim() ? 'available' : 'unavailable',
  };
}
export function toCloudMessages(messages: SpeakingMessage[]): SpeakingHistoryMessage[] {
  const result: SpeakingHistoryMessage[] = [];
  for (const message of messages) {
    if (message.role === 'summary') continue;
    if (!message.text?.trim() && message.transcriptStatus !== 'unavailable') break;
    result.push(cloudMessage(message));
  }
  return result;
}
export function canContinueInPlace(session: { source?: string; reviewed?: boolean }): boolean {
  return session.source === 'APP' && session.reviewed === false;
}
export function toLegacySession(
  conversation: SpeakingConversation,
  messages: SpeakingMessage[],
): SpeakingLegacySession {
  const sorted = [...messages].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const times = [
    conversation.createdAt,
    conversation.updatedAt,
    ...sorted.map((m) => m.createdAt),
  ].map(Date.parse);
  const summaries = sorted.flatMap((message, ordinal) =>
    message.role === 'summary'
      ? [
          {
            id: message.id,
            text: message.text || '（原摘要無文字）',
            createdAt: new Date(message.createdAt).toISOString(),
            ordinal,
          },
        ]
      : [],
  );
  if (!summaries.length && conversation.summary?.trim())
    summaries.push({
      id: `legacy-summary:${conversation.id}`,
      text: conversation.summary,
      createdAt: new Date(Math.max(...times)).toISOString(),
      ordinal: sorted.length,
    });
  return {
    clientSessionId: conversation.id,
    title: conversation.title || '舊口說紀錄',
    startedAt: new Date(Math.min(...times)).toISOString(),
    endedAt: new Date(Math.max(...times)).toISOString(),
    messages: sorted.filter((m) => m.role !== 'summary').map(cloudMessage),
    summaries,
  };
}
export function createAppReviewDraft(input: {
  origin: string;
  context: SpeakingPracticeContext;
  session: SpeakingSessionRecord;
  messages: SpeakingHistoryMessage[];
  analysis: SpeakingSummaryResult;
}): SpeakingReviewDraft {
  const { origin, context, session, messages, analysis } = input;
  if (!messages.length || !canContinueInPlace(session))
    throw new Error('請在未整理的 App 練習中保存 Review');
  const actualUses = analysis.actualUses.map((use) => ({
    targetVocabularyId: use.targetVocabularyId ?? '',
    term: use.term,
    expressionContext: use.expressionContext,
    naturalSentence: use.naturalSentence,
    evidence: use.evidence ?? [],
  }));
  const draft: SpeakingReviewDraft = {
    schemaVersion: 1,
    target: { apiOrigin: origin, userId: context.userId },
    contextVersion: context.vocabularyVersion,
    practice: {
      source: 'APP',
      sourceRef: {
        system: 'flashmind',
        conversationId: session.clientSessionId,
        sessionKey: 'app',
      },
      sessionId: session.id,
      title: analysis.title,
      startedAt: session.startedAt,
      endedAt: session.endedAt ?? messages.at(-1)!.createdAt,
      range: { firstMessageId: messages[0].id, lastMessageId: messages.at(-1)!.id },
      messages,
    },
    result: {
      summary: analysis.summary,
      review: analysis.review,
      actualUses,
      recommendations: analysis.recommendations.map((item) => ({
        targetVocabularyId: item.targetVocabularyId ?? '',
        term: item.term,
        expressionContext: item.expressionContext,
        naturalSentence: item.naturalSentence,
        recommendationReason: item.recommendationReason,
      })),
      nextPractice: analysis.nextPractice,
      deckCandidates: actualUses
        .filter(
          (use) =>
            context.targetVocabulary.find((word) => word.id === use.targetVocabularyId)?.status !==
            'ADDED',
        )
        .map((use) => use.targetVocabularyId),
    },
  };
  const errors = validateReviewDraft(draft, {
    userId: context.userId,
    apiOrigin: origin,
    words: context.targetVocabulary,
  });
  if (errors.length) throw new Error(`Review 驗證失敗：${errors[0].path} ${errors[0].message}`);
  return draft;
}
