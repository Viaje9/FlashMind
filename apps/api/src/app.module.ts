import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { DeckModule } from './modules/deck/deck.module';
import { CardModule } from './modules/card/card.module';
import { AiModule } from './modules/ai/ai.module';
import { TtsModule } from './modules/tts/tts.module';
import { StudyModule } from './modules/study/study.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    DeckModule,
    CardModule,
    AiModule,
    TtsModule,
    StudyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
