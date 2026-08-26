import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { TargetVocabularyController } from './target-vocabulary.controller';
import { TargetVocabularyService } from './target-vocabulary.service';

@Module({
  imports: [AuthModule],
  controllers: [TargetVocabularyController],
  providers: [TargetVocabularyService],
  exports: [TargetVocabularyService],
})
export class TargetVocabularyModule {}
