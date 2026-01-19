import { Module } from '@nestjs/common';
import { StudyController } from './study.controller';
import { StudyService } from './study.service';
import { AuthModule } from '../auth/auth.module';
import { FsrsModule } from '../fsrs';

@Module({
  imports: [AuthModule, FsrsModule],
  controllers: [StudyController],
  providers: [StudyService],
  exports: [StudyService],
})
export class StudyModule {}
