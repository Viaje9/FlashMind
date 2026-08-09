import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FsrsModule } from '../fsrs';
import { SpeakingController } from './speaking.controller';
import { SpeakingService } from './speaking.service';

@Module({
  imports: [AuthModule, FsrsModule],
  controllers: [SpeakingController],
  providers: [SpeakingService],
  exports: [SpeakingService],
})
export class SpeakingModule {}
