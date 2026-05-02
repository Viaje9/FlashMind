import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CollectionController } from './collection.controller';
import { CollectionService } from './collection.service';
import { CollectionAiProvider } from './collection-ai.provider';
import { CodexCollectionAiProvider } from './codex-collection-ai.provider';
import { CollectionToolService } from './collection-tool.service';

@Module({
  imports: [AuthModule],
  controllers: [CollectionController],
  providers: [
    CollectionService,
    CollectionToolService,
    {
      provide: CollectionAiProvider,
      useClass: CodexCollectionAiProvider,
    },
  ],
})
export class CollectionModule {}
