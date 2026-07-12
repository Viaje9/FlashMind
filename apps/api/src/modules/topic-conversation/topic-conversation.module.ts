import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { OpenAiTopicConversationAiProvider } from './openai-topic-conversation-ai.provider';
import { TopicConversationAiProvider } from './topic-conversation-ai.provider';
import { TopicConversationController } from './topic-conversation.controller';
import { TopicConversationService } from './topic-conversation.service';

@Module({
  imports: [AuthModule],
  controllers: [TopicConversationController],
  providers: [
    TopicConversationService,
    {
      provide: TopicConversationAiProvider,
      useClass: OpenAiTopicConversationAiProvider,
    },
  ],
})
export class TopicConversationModule {}
