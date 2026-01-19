import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TtsService {
  private readonly apiKey: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('AZURE_SPEECH_KEY') ?? '';
    this.region = this.configService.get<string>('AZURE_SPEECH_REGION') ?? 'eastasia';
  }

  async synthesizeWord(text: string): Promise<Buffer> {
    const encodedText = encodeURIComponent(text);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&total=1&idx=0&textlen=${text.length}&client=tw-ob&q=${encodedText}&tl=en`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      if (!response.ok) {
        throw new InternalServerErrorException({
          error: {
            code: 'TTS_SERVICE_ERROR',
            message: '語音服務暫時無法使用，請稍後再試',
          },
        });
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException({
        error: {
          code: 'TTS_SERVICE_ERROR',
          message: '語音服務暫時無法使用，請稍後再試',
        },
      });
    }
  }

  async synthesize(text: string): Promise<Buffer> {
    const ssml = this.buildSsml(text);
    const url = `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
          'Ocp-Apim-Subscription-Key': this.apiKey,
        },
        body: ssml,
      });

      if (!response.ok) {
        throw new InternalServerErrorException({
          error: {
            code: 'TTS_SERVICE_ERROR',
            message: '語音服務暫時無法使用，請稍後再試',
          },
        });
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException({
        error: {
          code: 'TTS_SERVICE_ERROR',
          message: '語音服務暫時無法使用，請稍後再試',
        },
      });
    }
  }

  private buildSsml(text: string): string {
    const escapedText = this.escapeXml(text);
    return `<speak version='1.0' xml:lang='en-US'><voice name='en-US-AvaMultilingualNeural'>${escapedText}</voice></speak>`;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
