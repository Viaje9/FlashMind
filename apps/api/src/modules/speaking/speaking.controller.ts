import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';
import { WhitelistGuard } from '../auth/whitelist.guard';
import {
  CreateSpeakingChatDto,
  SpeakingAssistantChatDto,
  SpeakingChatHistoryItemDto,
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
      },
    }),
  )
  async createSpeakingAudioReply(
    @UploadedFile() audioFile: UploadedAudioFile,
    @Body() body: Record<string, string>,
  ) {
    if (!audioFile?.buffer || audioFile.buffer.length === 0) {
      throw this.createValidationError('audioFile 為必填欄位');
    }

    const history = this.parseHistory(body.history);
    const voice = this.parseVoice(body.voice);
    const autoMemoryEnabled = this.parseBoolean(body.autoMemoryEnabled);

    const result = await this.speakingService.createAudioReply({
      audioBuffer: audioFile.buffer,
      history,
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

  private parseHistory(rawHistory?: string): SpeakingChatHistoryItemDto[] {
    if (!rawHistory?.trim()) {
      return [];
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(rawHistory);
    } catch {
      throw this.createValidationError('history 格式錯誤，需為 JSON 字串');
    }

    if (!Array.isArray(parsed)) {
      throw this.createValidationError('history 必須為陣列');
    }

    const items: SpeakingChatHistoryItemDto[] = [];

    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') {
        throw this.createValidationError('history 項目格式錯誤');
      }

      const role = (entry as { role?: string }).role;
      const text = (entry as { text?: string }).text;
      const audioBase64 = (entry as { audioBase64?: string }).audioBase64;

      if (role !== 'user' && role !== 'assistant') {
        throw this.createValidationError(
          'history.role 必須為 user 或 assistant',
        );
      }

      if (!text?.trim() && !audioBase64?.trim()) {
        throw this.createValidationError(
          'history 項目至少要有 text 或 audioBase64',
        );
      }

      items.push({
        role,
        text: text?.trim() || undefined,
        audioBase64: audioBase64?.trim() || undefined,
      });
    }

    return items;
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
