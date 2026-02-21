import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import {
  SPEAKING_DEFAULT_SETTINGS,
  createConversationRecord,
  createConversationTitle,
  createSpeakingId,
  trimSpeakingHistoryByBytes,
  toSpeakingHistory,
  updateConversationFromMessages,
  type SpeakingMessage,
} from './speaking.domain';

describe('speaking.domain', () => {
  it('預設設定應包含 voice 與 memory 欄位', () => {
    expect(SPEAKING_DEFAULT_SETTINGS).toMatchObject({
      autoPlayVoice: true,
      showTranscript: true,
      autoTranslate: false,
      systemPrompt: '',
      voice: 'nova',
      memory: '',
      autoMemoryEnabled: true,
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

  it('應在歷史 payload 過大時裁切最舊訊息', () => {
    const history = [
      { role: 'assistant' as const, text: 'oldest message' },
      { role: 'assistant' as const, text: 'keep this message' },
    ];

    const maxBytes = new TextEncoder().encode(JSON.stringify([history[1]])).length;
    const trimmed = trimSpeakingHistoryByBytes(history, maxBytes);

    expect(trimmed).toEqual([history[1]]);
  });

  it('若單一歷史項目也超出限制時應回傳空陣列', () => {
    const history = [{ role: 'assistant' as const, text: 'x'.repeat(200) }];
    const trimmed = trimSpeakingHistoryByBytes(history, 10);

    expect(trimmed).toEqual([]);
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
});
