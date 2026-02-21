import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { WhitelistGuard } from '../auth/whitelist.guard';
import {
  CreateSpeakingChatDto,
  SpeakingAssistantChatDto,
  SpeakingSummarizeDto,
  SpeakingTranslateDto,
  SpeakingVoicePreviewDto,
} from './dto';
import { SpeakingService, type SpeakingVoice } from './speaking.service';

interface UploadedAudioFile {
  buffer: Buffer;
}

const SPEAKING_VOICES: readonly SpeakingVoice[] = [
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'nova',
  'onyx',
  'sage',
  'shimmer',
] as const;

@Controller('speaking')
@UseGuards(AuthGuard, WhitelistGuard)
export class SpeakingController {
  constructor(private readonly speakingService: SpeakingService) {}

  @Post('chat')
  async createSpeakingReply(@Body() dto: CreateSpeakingChatDto) {
    const result = await this.speakingService.createReply(dto);
    return { data: result };
  }

  @Post('chat/audio')
  @UseInterceptors(
    FileInterceptor('audioFile', {
      limits: {
        fileSize: 8 * 1024 * 1024,
        fieldSize: 4 * 1024 * 1024,
        fields: 10,
      },
    }),
  )
  async createSpeakingAudioReply(
    @UploadedFile() audioFile: UploadedAudioFile,
    @Body() body: Record<string, string>,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!audioFile?.buffer || audioFile.buffer.length === 0) {
      throw this.createValidationError('audioFile 為必填欄位');
    }

    if (typeof body.history !== 'undefined') {
      throw this.createValidationError(
        'history 欄位已停用，請改用 conversationId',
      );
    }

    const conversationId = this.parseConversationId(body.conversationId);
    const voice = this.parseVoice(body.voice);
    const autoMemoryEnabled = this.parseBoolean(body.autoMemoryEnabled);

    const result = await this.speakingService.createAudioReply({
      userId: request.user.id,
      audioBuffer: audioFile.buffer,
      conversationId,
      voice,
      systemPrompt: body.systemPrompt,
      memory: body.memory,
      autoMemoryEnabled,
    });

    return { data: result };
  }

  @Post('summarize')
  async summarize(@Body() dto: SpeakingSummarizeDto) {
    const result = await this.speakingService.summarizeConversation(
      dto.history ?? [],
    );
    return { data: result };
  }

  @Post('translate')
  async translate(@Body() dto: SpeakingTranslateDto) {
    const result = await this.speakingService.translateToTraditionalChinese(
      dto.text,
    );
    return { data: result };
  }

  @Post('assistant/chat')
  async assistantChat(@Body() dto: SpeakingAssistantChatDto) {
    const result = await this.speakingService.chatAssistant(dto);
    return { data: result };
  }

  @Post('voice-preview')
  async previewVoice(@Body() dto: SpeakingVoicePreviewDto) {
    const result = await this.speakingService.previewVoice(dto.voice);
    return { data: result };
  }

  private parseConversationId(value?: string): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private parseVoice(rawVoice?: string): SpeakingVoice | undefined {
    if (!rawVoice?.trim()) {
      return undefined;
    }

    const voice = rawVoice.trim() as SpeakingVoice;
    if (!SPEAKING_VOICES.includes(voice)) {
      throw this.createValidationError('voice 格式錯誤');
    }

    return voice;
  }

  private parseBoolean(value?: string): boolean {
    if (!value) return false;
    return value === 'true' || value === '1';
  }

  private createValidationError(message: string) {
    return new BadRequestException({
      error: {
        code: 'VALIDATION_ERROR',
        message,
      },
    });
  }
}
