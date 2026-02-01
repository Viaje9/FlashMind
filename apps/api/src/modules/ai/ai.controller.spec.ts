import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AuthGuard } from '../auth/auth.guard';
import { WhitelistGuard } from '../auth/whitelist.guard';

describe('AiController', () => {
  let controller: AiController;
  let aiService: AiService;

  const mockAiService = {
    generateCardContent: jest.fn(),
  };

  const mockGuard = {
    canActivate: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [{ provide: AiService, useValue: mockAiService }],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockGuard)
      .overrideGuard(WhitelistGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<AiController>(AiController);
    aiService = module.get<AiService>(AiService);

    jest.clearAllMocks();
  });

  describe('generateCardContent', () => {
    it('應該回傳生成的內容並包裝在 data 中', async () => {
      const mockResult = {
        meanings: [
          {
            zhMeaning: '你好',
            enExample: 'Hello, how are you?',
            zhExample: '你好，你好嗎？',
          },
        ],
      };
      mockAiService.generateCardContent.mockResolvedValue(mockResult);

      const result = await controller.generateCardContent({ text: 'Hello' });

      expect(aiService.generateCardContent).toHaveBeenCalledWith('Hello');
      expect(result).toEqual({ data: mockResult });
    });

    it('應該正確傳遞文字參數給 service', async () => {
      const mockResult = { meanings: [{ zhMeaning: '蘋果' }] };
      mockAiService.generateCardContent.mockResolvedValue(mockResult);

      await controller.generateCardContent({ text: 'Apple' });

      expect(aiService.generateCardContent).toHaveBeenCalledWith('Apple');
    });
  });
});
