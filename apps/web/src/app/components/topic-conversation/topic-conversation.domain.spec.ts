import '@angular/compiler';
import {
  TopicConversationCorrectionStatus,
  TopicConversationRole,
  type TopicConversationSessionDetail,
  type TopicConversationSessionSummary,
} from '@flashmind/api-client';
import { describe, expect, it } from 'vitest';
import {
  canSendTopicConversationMessage,
  mapTopicConversationCorrection,
  mapTopicConversationHistoryItem,
  mapTopicConversationSession,
} from './topic-conversation.domain';

const topic = {
  id: 'topic-1',
  title: '在飯店辦理入住',
  scenario: '你抵達預訂的飯店，準備向櫃檯人員辦理入住。',
  createdAt: '2026-07-12T08:00:00.000Z',
  updatedAt: '2026-07-12T08:00:00.000Z',
};

describe('topic-conversation.domain', () => {
  it('應將場次與訊息映射為 view model，並保留 API 訊息順序', () => {
    const session: TopicConversationSessionDetail = {
      id: 'session-1',
      topic,
      messages: [
        {
          id: 'assistant-1',
          role: TopicConversationRole.Assistant,
          content: 'Welcome! Do you have a reservation?',
          correction: null,
          createdAt: '2026-07-12T08:00:01.000Z',
        },
        {
          id: 'user-1',
          role: TopicConversationRole.User,
          content: 'Yes, I have reservation.',
          correction: {
            status: TopicConversationCorrectionStatus.Corrected,
            suggestedText: 'Yes, I have a reservation.',
            explanation: '可數名詞 reservation 前需要冠詞 a。',
          },
          createdAt: '2026-07-12T08:01:00.000Z',
        },
      ],
      createdAt: '2026-07-12T08:00:00.000Z',
      updatedAt: '2026-07-12T08:01:00.000Z',
    };

    const result = mapTopicConversationSession(session);

    expect(result).not.toBe(session);
    expect(result.messages.map((message) => message.id)).toEqual(['assistant-1', 'user-1']);
    expect(result.messages[1].content).toBe('Yes, I have reservation.');
    expect(result.messages[1].correction).toMatchObject({
      label: '建議修正',
      tone: 'warning',
      showDetails: true,
      suggestedText: 'Yes, I have a reservation.',
    });
  });

  it('句子正確時應標示成功，但不顯示不必要的改寫內容', () => {
    const result = mapTopicConversationCorrection({
      status: TopicConversationCorrectionStatus.Correct,
      suggestedText: 'An unnecessary rewrite.',
      explanation: '不應顯示的說明',
    });

    expect(result).toEqual({
      status: TopicConversationCorrectionStatus.Correct,
      label: '這句很自然',
      tone: 'success',
      showDetails: false,
      suggestedText: null,
      explanation: null,
    });
  });

  it('較自然與需修正的句子應提供不同顯示語意，並清理空白', () => {
    const improved = mapTopicConversationCorrection({
      status: TopicConversationCorrectionStatus.Improved,
      suggestedText: '  I would like some coffee.  ',
      explanation: '  這個說法更自然。  ',
    });

    expect(improved).toEqual({
      status: TopicConversationCorrectionStatus.Improved,
      label: '更自然的說法',
      tone: 'info',
      showDetails: true,
      suggestedText: 'I would like some coffee.',
      explanation: '這個說法更自然。',
    });
  });

  it('應建立歷史列表摘要，空白預覽時回退到訊息數', () => {
    const summary: TopicConversationSessionSummary = {
      id: 'session-1',
      topic,
      messageCount: 7,
      lastMessagePreview: '   ',
      createdAt: '2026-07-12T08:00:00.000Z',
      updatedAt: '2026-07-12T08:05:00.000Z',
    };

    expect(mapTopicConversationHistoryItem(summary)).toMatchObject({
      id: 'session-1',
      title: topic.title,
      scenario: topic.scenario,
      messageCount: 7,
      preview: '共 7 則訊息',
    });
  });

  it('只允許在未送出中且內容符合長度限制時送出', () => {
    expect(canSendTopicConversationMessage('  Hello!  ', false)).toBe(true);
    expect(canSendTopicConversationMessage('   ', false)).toBe(false);
    expect(canSendTopicConversationMessage('Hello!', true)).toBe(false);
    expect(canSendTopicConversationMessage('a'.repeat(4001), false)).toBe(false);
  });
});
