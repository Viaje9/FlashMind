import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TargetVocabularyModule } from '../target-vocabulary/target-vocabulary.module';
import { SpeakingHistoryController } from './speaking-history.controller';
import { SpeakingHistoryService } from './speaking-history.service';

@Module({
  imports: [AuthModule, TargetVocabularyModule],
  controllers: [SpeakingHistoryController],
  providers: [SpeakingHistoryService],
  exports: [SpeakingHistoryService],
})
export class SpeakingHistoryModule {}
