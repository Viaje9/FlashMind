import { describe, expect, it } from 'vitest';
import {
  toCloudMessages,
  toLegacySession,
  canContinueInPlace,
  createAppReviewDraft,
} from './speaking-history.domain';
import type { SpeakingConversation, SpeakingMessage } from './speaking.domain';

const conversation: SpeakingConversation = {
  id: 'local-1',
  title: '散步',
  createdAt: '2026-08-30T01:00:00.000Z',
  updatedAt: '2026-08-30T01:05:00.000Z',
  messageCount: 2,
};
const messages: SpeakingMessage[] = [
  {
    id: 'm1',
    conversationId: 'local-1',
    role: 'user',
    text: 'I walk every day.',
    audioBlobKey: 'm1:audio',
    createdAt: '2026-08-30T01:00:00.000Z',
  },
  {
    id: 'm2',
    conversationId: 'local-1',
    role: 'assistant',
    text: 'Where?',
    createdAt: '2026-08-30T01:01:00.000Z',
  },
];
describe('speaking-history.domain', () => {
  it('只同步完成的原文，不含音訊和 Summary；遇到未完成逐字稿停止', () => {
    const result = toCloudMessages([
      ...messages,
      { ...messages[0], id: 'pending', text: '' },
      { ...messages[1], id: 'later' },
    ]);
    expect(result.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(result[0]).toEqual({
      id: 'm1',
      role: 'user',
      text: messages[0].text,
      createdAt: messages[0].createdAt,
      hasOriginalAudio: true,
      transcriptStatus: 'available',
    });
    expect(JSON.stringify(result)).not.toContain('audioBlobKey');
  });
  it('搬移多份 Summary、翻譯與缺逐字稿標記，保留文字不重算', () => {
    const legacy = toLegacySession(conversation, [
      { ...messages[0], text: '', translatedText: '翻譯文字' },
      { ...messages[1], id: 's1', role: 'summary', text: '第一份摘要' },
      { ...messages[1], id: 's2', role: 'summary', text: '第二份摘要' },
    ]);
    expect(legacy.messages[0]).toMatchObject({
      text: '',
      transcriptStatus: 'unavailable',
      hasOriginalAudio: true,
      translatedText: '翻譯文字',
    });
    expect(legacy.summaries.map((s) => s.text)).toEqual(['第一份摘要', '第二份摘要']);
    expect(legacy.clientSessionId).toBe(conversation.id);
  });
  it('只有 conversation.summary 也會保存 legacy Summary', () => {
    const legacy = toLegacySession({ ...conversation, summary: '舊的文字摘要' }, []);
    expect(legacy.summaries).toHaveLength(1);
    expect(legacy.messages).toEqual([]);
  });
  it('只有未整理的 App 可以原場次延續', () => {
    expect(canContinueInPlace({ source: 'APP', reviewed: false })).toBe(true);
    expect(canContinueInPlace({ source: 'APP', reviewed: true })).toBe(false);
    expect(canContinueInPlace({ source: 'LOCAL', reviewed: false })).toBe(false);
  });
  it('App 草稿保留 AI 證據且範圍指向同一份完整文字', () => {
    const context = {
      schemaVersion: 1 as const,
      userId: 'u1',
      generatedAt: '2026-08-30T01:00:00.000Z',
      vocabularyVersion: 'v1',
      vocabularyCount: 1,
      targetVocabulary: [
        {
          id: 'w1',
          term: 'walk',
          zhMeaning: '散步',
          status: 'UNSEEN' as const,
          useCount: 0,
          recommendationCount: 0,
          expressionContext: null,
          naturalSentence: null,
          recommendationReason: null,
          addedCardId: null,
        },
      ],
      lastPractice: null,
      nextPractice: null,
    };
    const result = createAppReviewDraft({
      origin: 'https://flashmind.example',
      context,
      session: {
        id: 's1',
        clientSessionId: 'local-1',
        source: 'APP',
        title: '散步',
        startedAt: conversation.createdAt,
        endedAt: conversation.updatedAt,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        revision: 1,
        messageCount: 2,
        reviewed: false,
        summary: null,
      },
      messages: toCloudMessages(messages),
      analysis: {
        title: '散步',
        summary: 'I walk every day.',
        review: '表達清楚',
        actualUses: [
          {
            targetVocabularyId: 'w1',
            term: 'walk',
            zhMeaning: '散步',
            expressionContext: '描述習慣',
            naturalSentence: 'I walk every day.',
            evidence: [{ messageId: 'm1', quote: 'I walk every day.' }],
          },
        ],
        recommendations: [],
        nextPractice: {
          topic: 'Walks',
          speakingGoal: 'Describe a walk.',
          guidingQuestions: [],
          recallTargets: ['walk'],
        },
        usage: {} as never,
      },
    });
    expect(result.practice.range).toEqual({ firstMessageId: 'm1', lastMessageId: 'm2' });
    expect(result.result.deckCandidates).toEqual(['w1']);
    expect(result.result.actualUses[0].evidence[0].quote).toBe(messages[0].text);
    expect(result.result.actualUses[0]).not.toHaveProperty('zhMeaning');
  });
});
