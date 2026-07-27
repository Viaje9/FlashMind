import { Module } from '@nestjs/common';
import { CardController } from './card.controller';
import { CardService } from './card.service';
import { AuthModule } from '../auth/auth.module';
import { FsrsModule } from '../fsrs';

@Module({
  imports: [AuthModule, FsrsModule],
  controllers: [CardController],
  providers: [CardService],
  exports: [CardService],
})
export class CardModule {}
