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
      interactionMode: 'TURN_BASED',
      autoPlayVoice: true,
      showTranscript: true,
      showCost: true,
      autoTranslate: false,
      systemPrompt: '',
      voice: 'marin',
      memory: '',
      autoMemoryEnabled: true,
      nextPractice: undefined,
    });
  });

  it('Summary 依序保留具體表達建議、完整單字表格與英文朗讀稿', () => {
    const text = formatSpeakingReviewSummary({
      summary: 'My free time is limited, so I watch this series at a faster speed.',
      review:
        '### 說明播放速度\n\n你說 fast mode 是指加速播放。\n\n> I watch this series at a faster speed.\n\nat a faster speed 比較自然，不是快轉跳過片段。',
      actualUses: [
        {
          term: 'task',
          zhMeaning: '任務',
          expressionContext: '工作事項',
          naturalSentence: 'I finish a task.',
          evidence: [{ messageId: 'user-1', quote: 'I finish task' }],
        },
      ],
      recommendations: [
        {
          term: 'limited',
          zhMeaning: '有限的',
          expressionContext: '有限的：說明空閒時間不多',
          naturalSentence: 'My free time is limited.',
          recommendationReason: '能替換反覆使用的 not enough time。',
        },
      ],
      nextPractice: {
        topic: 'Watching shows',
        speakingGoal: '',
        guidingQuestions: [],
        recallTargets: ['limited'],
      },
    });
    expect(text.match(/^## .+$/gm)?.slice(0, 4)).toEqual([
      '## 可以說得更自然的地方',
      '## 這次實際使用的單字',
      '## 建議練習的單字',
      '## 可朗讀的英文摘要',
    ]);
    expect(text).toContain('at a faster speed 比較自然');
    expect(text).toContain(
      '| limited | 有限的：說明空閒時間不多 | My free time is limited. | 能替換反覆使用的 not enough time。 |',
    );
    expect(text).toContain('My free time is limited, so I watch this series at a faster speed.');
    expect(text).toContain('| task | 工作事項 | I finish task | I finish a task. |');
    expect(text).not.toContain('**這次實際使用：');
    expect(text).toContain('Watching shows');
  });

  it('沒有合適推薦也保留單字區塊，不把實際使用的字冒充推薦', () => {
    const text = formatSpeakingReviewSummary({
      summary: 'I walk.',
      review: '你的句子已能清楚表達散步。',
      actualUses: [],
      recommendations: [],
      nextPractice: { topic: '', speakingGoal: '', guidingQuestions: [], recallTargets: [] },
    });
    expect(text).toContain('## 建議練習的單字');
    expect(text).toContain('本次沒有需要額外推薦的目標單字');
    expect(text).toContain('本次沒有可確認的實際使用目標單字');
    expect(text).toContain('## 可朗讀的英文摘要');
  });

  it('表格欄位的分隔符號、換行與 HTML 不得破壞表格或插入標記', () => {
    const text = formatSpeakingReviewSummary({
      summary: 'I walk.',
      review: '表達建議',
      actualUses: [],
      recommendations: [
        {
          term: 'walk',
          zhMeaning: '',
          expressionContext: '散步 | 工作\n休息',
          naturalSentence: 'I walk <outside>.',
          recommendationReason: '**不是額外欄位**',
        },
      ],
      nextPractice: { topic: '', speakingGoal: '', guidingQuestions: [], recallTargets: [] },
    });
    const row = text.split('\n').find((line) => line.startsWith('| walk |'))!;
    expect(row.split('|')).toHaveLength(6);
    expect(row).toContain('&#124;');
    expect(row).not.toContain('<outside>');
    expect(row).not.toContain('**不是');
  });

  it('實際使用的原句保留證據文字；缺證據時不以自然句冒充', () => {
    const text = formatSpeakingReviewSummary({
      summary: 'I walk.',
      review: '表達建議',
      actualUses: [
        {
          term: 'walk',
          zhMeaning: '',
          expressionContext: '散步',
          naturalSentence: 'I walk outside.',
          evidence: [
            { messageId: 'u1', quote: 'I walk | outside\nwith <friends>' },
            { messageId: 'u2', quote: 'I walk again' },
          ],
        },
        {
          term: 'task',
          zhMeaning: '',
          expressionContext: '任務',
          naturalSentence: 'I finish a task.',
        },
      ],
      recommendations: [],
      nextPractice: { topic: '', speakingGoal: '', guidingQuestions: [], recallTargets: [] },
    });
    expect(text).toContain('I walk &#124; outside&#10;with &#60;friends&#62;');
    expect(text).toContain('I walk again');
    expect(text).toContain('| task | 任務 | 未提供原句證據 | I finish a task. |');
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
