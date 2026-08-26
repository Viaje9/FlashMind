import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FsrsModule } from '../fsrs';
import { TargetVocabularyModule } from '../target-vocabulary/target-vocabulary.module';
import { SpeakingController } from './speaking.controller';
import { SpeakingService } from './speaking.service';
import { SpeakingRealtimeGateway } from './speaking-realtime.gateway';

@Module({
  imports: [AuthModule, FsrsModule, TargetVocabularyModule],
  controllers: [SpeakingController],
  providers: [SpeakingService, SpeakingRealtimeGateway],
  exports: [SpeakingService],
})
export class SpeakingModule {}
