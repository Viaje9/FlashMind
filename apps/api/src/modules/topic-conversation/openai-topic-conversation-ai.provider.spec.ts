import {
  CONVERSATION_INSTRUCTIONS,
  HINT_INSTRUCTIONS,
  TOPIC_INSTRUCTIONS,
} from './openai-topic-conversation-ai.provider';

describe('OpenAiTopicConversationAiProvider prompt policy', () => {
  it.each([
    ['主題開場', TOPIC_INSTRUCTIONS],
    ['對話與修正', CONVERSATION_INSTRUCTIONS],
    ['按需提示', HINT_INSTRUCTIONS],
  ])('%s 應固定使用 CEFR B1', (_name, instructions) => {
    expect(instructions).toContain('CEFR B1');
  });
});
