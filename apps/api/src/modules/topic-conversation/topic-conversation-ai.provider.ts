export type TopicConversationCorrectionStatus =
  | 'correct'
  | 'improved'
  | 'corrected';

export interface TopicConversationTopicContext {
  title: string;
  scenario: string;
}

export interface TopicConversationHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateTopicConversationInput {
  excludedTopics: TopicConversationTopicContext[];
}

export interface GenerateTopicConversationResult extends TopicConversationTopicContext {
  openingMessage: string;
}

export interface ContinueTopicConversationInput {
  topic: TopicConversationTopicContext;
  history: TopicConversationHistoryMessage[];
  message: string;
  onReplyDelta?: (delta: string) => void | Promise<void>;
}

export interface TopicConversationCorrection {
  status: TopicConversationCorrectionStatus;
  correctedText: string | null;
  explanation: string | null;
}

export interface ContinueTopicConversationResult {
  reply: string;
  correction: TopicConversationCorrection;
}

export interface GenerateTopicConversationHintInput {
  topic: TopicConversationTopicContext;
  history: TopicConversationHistoryMessage[];
}

export interface GenerateTopicConversationHintResult {
  suggestions: string[];
}

export abstract class TopicConversationAiProvider {
  abstract generateTopic(
    input: GenerateTopicConversationInput,
  ): Promise<GenerateTopicConversationResult>;

  abstract continueConversation(
    input: ContinueTopicConversationInput,
  ): Promise<ContinueTopicConversationResult>;

  abstract generateHint(
    input: GenerateTopicConversationHintInput,
  ): Promise<GenerateTopicConversationHintResult>;
}
