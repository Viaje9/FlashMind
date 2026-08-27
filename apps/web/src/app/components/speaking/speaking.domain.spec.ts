import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import {
  SPEAKING_DEFAULT_SETTINGS,
  SPEAKING_DEFAULT_SYSTEM_PROMPT,
  createSelectionTranslationCacheKey,
  createConversationRecord,
  createConversationTitle,
  createSpeakingId,
  formatSpeakingReviewSummary,
  isSelectionTranslationResultStale,
  normalizeSelectionTranslationText,
  parseSpeakingReviewSummary,
  toSpeakingHistory,
  updateConversationFromMessages,
  type SpeakingMessage,
} from './speaking.domain';

describe('speaking.domain', () => {
  it('預設口說 prompt 應維持朋友式對話並將教學留給使用者明確請求', () => {
    expect(SPEAKING_DEFAULT_SYSTEM_PROMPT).toContain(
      'Respond to what the user is talking about, not to the quality of their English',
    );
    expect(SPEAKING_DEFAULT_SYSTEM_PROMPT).toContain(
      'End every live-conversation reply with exactly one simple, natural question',
    );
    expect(SPEAKING_DEFAULT_SYSTEM_PROMPT).toContain(
      "clarify the user's meaning; deepen the current topic; open a naturally related topic; then use the next-practice context",
    );
    expect(SPEAKING_DEFAULT_SYSTEM_PROMPT).toContain(
      'Never ask the user to repeat, make another sentence, try again, or deliberately use a word',
    );
    expect(SPEAKING_DEFAULT_SYSTEM_PROMPT).toContain(
      'After helping, return directly to the original conversation',
    );
    expect(SPEAKING_DEFAULT_SYSTEM_PROMPT).toContain(
      'A clear ending instruction is the only exception to the one-question rule',
    );
  });

  it('預設設定應包含 voice 與 memory 欄位', () => {
    expect(SPEAKING_DEFAULT_SETTINGS).toMatchObject({
      autoPlayVoice: true,
      showTranscript: true,
      autoTranslate: false,
      systemPrompt: '',
      voice: 'marin',
      memory: '',
      autoMemoryEnabled: true,
      nextPractice: undefined,
    });
  });

  it('應把 Review、實際使用、推薦與下次主題整理成可閱讀內容', () => {
    const text = formatSpeakingReviewSummary({
      summary: 'I explained how I work with an AI agent.',
      review: '你有把先產生初稿、再檢查調整的流程說清楚。',
      actualUses: [
        {
          term: 'function',
          zhMeaning: '功能',
          expressionContext: '描述 node tree 的需求。',
          naturalSentence: 'It depends on what kind of function the node tree needs.',
        },
      ],
      recommendations: [
        {
          term: 'cooperation',
          zhMeaning: '合作；協作',
          expressionContext: '描述與 AI 一起工作。',
          naturalSentence: 'This is cooperation between me and the AI agent.',
          recommendationReason: '符合本次對話。',
        },
      ],
      nextPractice: {
        topic: 'How I collaborate with AI',
        speakingGoal: 'Explain one workflow.',
        guidingQuestions: [],
        recallTargets: ['cooperation'],
      },
    });

    expect(text).toContain('練習回顧');
    expect(text).toContain('function（功能）');
    expect(text).toContain('cooperation（合作；協作）');
    expect(text).toContain('How I collaborate with AI');
  });

  it('應把既有對話整理文字拆成可視覺化的固定區塊', () => {
    expect(
      parseSpeakingReviewSummary(`I explained my English-learning plan.

練習回顧
你有清楚說明目前的學習方向。

這次實際使用
• practice（練習）
• website（網站）

下次可以試試
• confidence（信心）

下次主題
My English-learning website`),
    ).toEqual({
      summary: 'I explained my English-learning plan.',
      review: '你有清楚說明目前的學習方向。',
      actualUses: ['practice（練習）', 'website（網站）'],
      recommendations: ['confidence（信心）'],
      nextTopic: 'My English-learning website',
    });
  });

  it('舊的非結構化摘要應完整保留為主摘要', () => {
    expect(parseSpeakingReviewSummary('A legacy summary without headings.')).toEqual({
      summary: 'A legacy summary without headings.',
      review: '',
      actualUses: [],
      recommendations: [],
      nextTopic: '',
    });
  });

  it('應產生可用且不同的 id', () => {
    const id1 = createSpeakingId();
    const id2 = createSpeakingId();

    expect(id1.length).toBeGreaterThan(5);
    expect(id1).not.toBe(id2);
  });

  it('應根據第一句訊息建立標題，並截斷過長內容', () => {
    expect(createConversationTitle('  Hello there  ')).toBe('Hello there');
    expect(createConversationTitle('')).toBe('新對話');
    expect(createConversationTitle('This is a very long speaking message for title')).toBe(
      'This is a very long spea...',
    );
  });

  it('應將語音與文字訊息映射為 speaking history', async () => {
    const messages: SpeakingMessage[] = [
      {
        id: 'm1',
        conversationId: 'c1',
        role: 'user',
        audioBlobKey: 'u1:audio',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'm2',
        conversationId: 'c1',
        role: 'assistant',
        text: 'Hi there!',
        createdAt: '2026-01-01T00:00:01.000Z',
      },
      {
        id: 'm3',
        conversationId: 'c1',
        role: 'summary',
        text: 'summary text',
        createdAt: '2026-01-01T00:00:02.000Z',
      },
    ];

    const resolveAudio = vi.fn().mockResolvedValue('BASE64_AUDIO');
    const history = await toSpeakingHistory(messages, resolveAudio);

    expect(history).toEqual([
      { role: 'user', audioBase64: 'BASE64_AUDIO' },
      { role: 'assistant', text: 'Hi there!' },
    ]);
    expect(resolveAudio).toHaveBeenCalledWith('u1:audio');
  });

  it('應忽略不支援的歷史語音格式，改用文字內容', async () => {
    const messages: SpeakingMessage[] = [
      {
        id: 'm1',
        conversationId: 'c1',
        role: 'user',
        text: 'This should be used as fallback',
        audioBlobKey: 'u1:audio',
        audioMimeType: 'audio/webm',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const resolveAudio = vi.fn().mockResolvedValue('BASE64_WEBM_AUDIO');
    const history = await toSpeakingHistory(messages, resolveAudio);

    expect(history).toEqual([{ role: 'user', text: 'This should be used as fallback' }]);
  });

  it('應可建立與更新 conversation metadata', () => {
    const initialMessages: SpeakingMessage[] = [
      {
        id: 'm1',
        conversationId: 'c1',
        role: 'assistant',
        text: 'Hello there',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const base = createConversationRecord({
      id: 'c1',
      firstMessageText: initialMessages[0].text,
    });

    expect(base.id).toBe('c1');
    expect(base.title).toBe('Hello there');

    const updated = updateConversationFromMessages(base, [
      ...initialMessages,
      {
        id: 'm2',
        conversationId: 'c1',
        role: 'summary',
        text: 'summary content',
        createdAt: '2026-01-01T00:00:02.000Z',
      },
    ]);

    expect(updated.messageCount).toBe(2);
    expect(updated.summary).toBe('summary content');
    expect(updated.updatedAt).not.toBe(base.updatedAt);
  });

  it('應正規化選取翻譯文字並建立快取鍵', () => {
    expect(normalizeSelectionTranslationText('  hello world  ')).toBe('hello world');
    expect(createSelectionTranslationCacheKey('m-1', '  hello world  ')).toBe('m-1:hello world');
  });

  it('應可判斷 selection translation 回應是否過期', () => {
    expect(isSelectionTranslationResultStale(5, 4)).toBe(true);
    expect(isSelectionTranslationResultStale(5, 5)).toBe(false);
  });
});
