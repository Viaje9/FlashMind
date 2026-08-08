import { Module } from '@nestjs/common';
import { StudyController } from './study.controller';
import { StudyService } from './study.service';
import { AuthModule } from '../auth/auth.module';
import { FsrsModule } from '../fsrs';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AuthModule, FsrsModule, AiModule],
  controllers: [StudyController],
  providers: [StudyService],
  exports: [StudyService],
})
export class StudyModule {}
