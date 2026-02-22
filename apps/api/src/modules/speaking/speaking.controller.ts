import {
  ArgumentsHost,
  BadRequestException,
  Body,
  Catch,
  Controller,
  ExceptionFilter,
  Post,
  UploadedFile,
  UseGuards,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
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

@Catch(BadRequestException)
class SpeakingAudioBadRequestLogFilter implements ExceptionFilter<BadRequestException> {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const payload = exception.getResponse();
    const message = this.getMessage(payload);

    if (message.includes('Field value too long')) {
      const headers = request.headers as Record<string, unknown>;
      const contentLength = this.readHeaderValue(headers['content-length']);
      const contentType = this.readHeaderValue(headers['content-type']);
      const field = message.split(' - ')[1] ?? 'unknown';

      console.error('[SpeakingController] Multipart field value too long', {
        field,
        method: request.method,
        path: request.originalUrl ?? request.url,
        contentLength,
        contentType,
      });
    }

    response.status(exception.getStatus()).json(payload);
  }

  private getMessage(payload: unknown): string {
    if (!payload || typeof payload !== 'object') {
      return '';
    }

    const message = (payload as { message?: string | string[] }).message;
    if (Array.isArray(message)) {
      return message.join(', ');
    }

    return typeof message === 'string' ? message : '';
  }

  private readHeaderValue(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value) && typeof value[0] === 'string') {
      return value[0];
    }

    return undefined;
  }
}

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
  @UseFilters(SpeakingAudioBadRequestLogFilter)
  @UseInterceptors(
    FileInterceptor('audioFile', {
      limits: {
        fileSize: 2 * 1024 * 1024 * 1024,
        fieldSize: 2 * 1024 * 1024 * 1024,
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
