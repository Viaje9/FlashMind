import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { SpeakingService } from '@flashmind/api-client';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeakingReviewDiscussionStore } from './speaking-review-discussion.store';
import type { SpeakingConversation } from './speaking.domain';

const conversation: SpeakingConversation = {
  id: 'original',
  title: '看影集',
  summary: '練習過去式',
  messageCount: 1,
  createdAt: '',
  updatedAt: '',
  reviewed: true,
};

describe('SpeakingReviewDiscussionStore', () => {
  let store: SpeakingReviewDiscussionStore;
  const reply = vi.fn();
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SpeakingReviewDiscussionStore,
        { provide: SpeakingService, useValue: { createSpeakingReply: reply } },
      ],
    });
    reply.mockReset().mockReturnValue(of({ data: { reply: '可以說 I watched a show.' } }));
    store = TestBed.inject(SpeakingReviewDiscussionStore);
  });
  afterEach(() => TestBed.resetTestingModule());

  it('帶入原逐字稿及回顧，但不修改原紀錄；後續回合保留暫時討論', async () => {
    const original = structuredClone(conversation);
    store.start(conversation, [
      {
        id: 'm1',
        conversationId: 'original',
        role: 'user',
        text: 'I watch yesterday.',
        createdAt: '',
      },
    ]);
    await store.sendMessage('哪裡可以改進？');
    const request = reply.mock.calls[0][0];
    expect(request.history.map((m: { content: string }) => m.content).join('')).toContain(
      'I watch yesterday.',
    );
    expect(request.history.map((m: { content: string }) => m.content).join('')).toContain(
      '練習過去式',
    );
    expect(store.messages().at(-1)?.content).toBe('可以說 I watched a show.');
    await store.sendMessage('為什麼用 watched？');
    expect(reply.mock.calls[1][0].history).toEqual(
      expect.arrayContaining([expect.objectContaining({ content: '哪裡可以改進？' })]),
    );
    expect(conversation).toEqual(original);
  });

  it('長逐字稿與回覆分段符合每段 1000 字契約且不遺漏', async () => {
    store.start({ ...conversation, summary: '甲'.repeat(2501) }, []);
    await store.sendMessage('請說明');
    const history = reply.mock.calls[0][0].history as { content: string }[];
    expect(history.every((m) => m.content.length <= 1000)).toBe(true);
    expect(history.map((m) => m.content).join('')).toContain('甲'.repeat(2501));
  });

  it('失敗保留錯誤且重試不重複加入使用者訊息', async () => {
    store.start(conversation, []);
    reply.mockReturnValueOnce(throwError(() => new Error('offline')));
    await store.sendMessage('請說明');
    expect(store.error()).toBeTruthy();
    expect(store.messages().filter((m) => m.role === 'user')).toHaveLength(0);
    await store.sendMessage('請說明');
    expect(store.messages().filter((m) => m.role === 'user')).toHaveLength(1);
  });

  it('標記片段可只保留或加入備註，並帶入下一次回顧上下文', async () => {
    store.start(conversation, []);

    const marked = store.addMarkedContext({
      messageId: 'm1',
      selectedText: 'I watch yesterday.',
    });
    expect(marked).toEqual(
      expect.objectContaining({
        messageId: 'm1',
        selectedText: 'I watch yesterday.',
        note: null,
      }),
    );

    const updated = store.addMarkedContext({
      messageId: 'm1',
      selectedText: ' I watch yesterday. ',
      note: '想確認過去式',
    });
    expect(updated?.id).toBe(marked?.id);
    expect(store.markedContexts()).toEqual([
      expect.objectContaining({
        selectedText: 'I watch yesterday.',
        note: '想確認過去式',
      }),
    ]);

    await store.sendMessage('請說明這句');
    const history = reply.mock.calls[0][0].history as { content: string }[];
    expect(history.map((message) => message.content).join('')).toContain('I watch yesterday.');
    expect(history.map((message) => message.content).join('')).toContain('想確認過去式');

    store.removeMarkedContext(marked?.id ?? '');
    expect(store.markedContexts()).toEqual([]);
  });

  it('可由標記位置重新編輯備註，也能清空備註只保留標記', () => {
    store.start(conversation, []);
    const marked = store.addMarkedContext({
      messageId: 'm1',
      selectedText: 'I watch yesterday.',
      note: '先記下原句',
    });

    const updated = store.updateMarkedContext(marked?.id ?? '', '改成想複習過去式');
    expect(updated).toEqual(
      expect.objectContaining({
        id: marked?.id,
        messageId: 'm1',
        selectedText: 'I watch yesterday.',
        note: '改成想複習過去式',
      }),
    );

    const cleared = store.updateMarkedContext(marked?.id ?? '', '   ');
    expect(cleared?.note).toBeNull();
    expect(store.updateMarkedContext('missing', '不應存在')).toBeNull();
  });

  it('離開立即取消請求並清除內容，重新進入沒有後續討論', async () => {
    const pending = new Subject();
    reply.mockReturnValue(pending);
    store.start(conversation, []);
    const sending = store.sendMessage('暫時問題');
    expect(pending.observed).toBe(true);
    store.clear();
    await sending;
    expect(pending.observed).toBe(false);
    expect(store.messages()).toEqual([]);
    store.start(conversation, []);
    expect(store.messages().some((m) => m.content.includes('暫時問題'))).toBe(false);
    expect(store.markedContexts()).toEqual([]);
  });
});
