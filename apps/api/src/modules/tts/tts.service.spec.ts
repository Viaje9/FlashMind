import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { TtsService } from './tts.service';

describe('TtsService', () => {
  let service: TtsService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TtsService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<TtsService>(TtsService);

    jest.clearAllMocks();
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'AZURE_SPEECH_KEY') return 'test-speech-key';
      if (key === 'AZURE_SPEECH_REGION') return 'eastasia';
      return undefined;
    });
  });

  describe('synthesize', () => {
    it('應該回傳 Buffer 音訊資料', async () => {
      const mockAudioBuffer = Buffer.from('mock audio data');
      const mockResponse = {
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(mockAudioBuffer),
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const result = await service.synthesize('Hello');

      expect(result).toBeInstanceOf(Buffer);
    });

    it('應該正確呼叫 Azure Speech API', async () => {
      const mockAudioBuffer = Buffer.from('mock audio data');
      const mockResponse = {
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(mockAudioBuffer),
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      await service.synthesize('Hello');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://eastasia.tts.speech.microsoft.com/cognitiveservices/v1',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
            'Ocp-Apim-Subscription-Key': 'test-speech-key',
          }),
        }),
      );
    });

    it('應該使用正確的 SSML 格式', async () => {
      const mockAudioBuffer = Buffer.from('mock audio data');
      const mockResponse = {
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(mockAudioBuffer),
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      await service.synthesize('Hello world');

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = fetchCall[1].body;

      expect(body).toContain("<speak version='1.0' xml:lang='en-US'>");
      expect(body).toContain("<voice name='en-US-AvaMultilingualNeural'>");
      expect(body).toContain('Hello world');
      expect(body).toContain('</voice>');
      expect(body).toContain('</speak>');
    });

    it('API 回應非 ok 時應該拋出 InternalServerErrorException', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal Server Error'),
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      await expect(service.synthesize('Hello')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('網路錯誤時應該拋出 InternalServerErrorException', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(service.synthesize('Hello')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('應該對特殊字元進行 XML 跳脫', async () => {
      const mockAudioBuffer = Buffer.from('mock audio data');
      const mockResponse = {
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(mockAudioBuffer),
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      await service.synthesize('Hello & goodbye <world>');

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = fetchCall[1].body;

      expect(body).toContain('Hello &amp; goodbye &lt;world&gt;');
    });
  });

  describe('synthesizeWord', () => {
    it('應該回傳 Buffer 音訊資料', async () => {
      const mockAudioBuffer = Buffer.from('mock audio data');
      const mockResponse = {
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(mockAudioBuffer),
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const result = await service.synthesizeWord('hello');

      expect(result).toBeInstanceOf(Buffer);
    });

    it('應該正確呼叫 Google Translate TTS', async () => {
      const mockAudioBuffer = Buffer.from('mock audio data');
      const mockResponse = {
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(mockAudioBuffer),
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      await service.synthesizeWord('hello');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('translate.google.com/translate_tts'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.any(String),
          }),
        }),
      );
    });

    it('應該正確編碼文字參數', async () => {
      const mockAudioBuffer = Buffer.from('mock audio data');
      const mockResponse = {
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(mockAudioBuffer),
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      await service.synthesizeWord('hello');

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const url = fetchCall[0];

      expect(url).toContain('q=hello');
      expect(url).toContain('tl=en');
      expect(url).toContain('textlen=5');
    });

    it('API 回應非 ok 時應該拋出 InternalServerErrorException', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      await expect(service.synthesizeWord('hello')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('網路錯誤時應該拋出 InternalServerErrorException', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(service.synthesizeWord('hello')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
