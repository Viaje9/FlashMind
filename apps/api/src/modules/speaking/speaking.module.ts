import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SpeakingController } from './speaking.controller';
import {
  InMemorySpeakingSessionStore,
  SPEAKING_SESSION_STORE,
} from './speaking-session.store';
import { SpeakingService } from './speaking.service';

@Module({
  imports: [AuthModule],
  controllers: [SpeakingController],
  providers: [
    SpeakingService,
    {
      provide: SPEAKING_SESSION_STORE,
      useClass: InMemorySpeakingSessionStore,
    },
  ],
  exports: [SpeakingService],
})
export class SpeakingModule {}
