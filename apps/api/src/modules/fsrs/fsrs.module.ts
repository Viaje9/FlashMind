import { Module } from '@nestjs/common';
import { FsrsService } from './fsrs.service';

@Module({
  providers: [FsrsService],
  exports: [FsrsService],
})
export class FsrsModule {}
