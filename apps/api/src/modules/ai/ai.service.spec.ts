import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { AiService, GeneratedMeaning } from './ai.service';

describe('AiService', () => {
  let service: AiService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue('test-api-key');
  });

  describe('generateCardContent', () => {
    it('應該回傳生成的詞義陣列（含詞性標註）', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  meanings: [
                    {
                      zhMeaning: '你好 (interj.)',
                      enExample: 'Hello, how are you?',
                      zhExample: '你好，你好嗎？',
                    },
                  ],
                }),
              },
            },
          ],
        }),
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const result = await service.generateCardContent('Hello');

      expect(result.meanings).toHaveLength(1);
      expect(result.meanings[0]).toEqual({
        zhMeaning: '你好 (interj.)',
        enExample: 'Hello, how are you?',
        zhExample: '你好，你好嗎？',
      });
    });

    it('應該正確呼叫 OpenAI API', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  meanings: [{ zhMeaning: '你好' }],
                }),
              },
            },
          ],
        }),
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      await service.generateCardContent('Hello');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key',
          }),
        }),
      );
    });

    it('API 回應非 ok 時應該拋出 InternalServerErrorException', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal Server Error'),
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      await expect(service.generateCardContent('Hello')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('API 回傳無效 JSON 時應該拋出 InternalServerErrorException', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'invalid json',
              },
            },
          ],
        }),
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      await expect(service.generateCardContent('Hello')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('網路錯誤時應該拋出 InternalServerErrorException', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(service.generateCardContent('Hello')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('回傳結果應包含多筆詞義（含不同詞性）', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  meanings: [
                    { zhMeaning: '跑步 (v.)', enExample: 'I run every morning.', zhExample: '我每天早上跑步。' },
                    { zhMeaning: '賽跑 (n.)', enExample: 'He finished the run in 10 minutes.', zhExample: '他在 10 分鐘內完成賽跑。' },
                  ],
                }),
              },
            },
          ],
        }),
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const result = await service.generateCardContent('run');

      expect(result.meanings).toHaveLength(2);
      expect(result.meanings[0].zhMeaning).toBe('跑步 (v.)');
      expect(result.meanings[1].zhMeaning).toBe('賽跑 (n.)');
    });
  });
});
