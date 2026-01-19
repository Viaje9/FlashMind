import { Test, TestingModule } from '@nestjs/testing';
import { StreamableFile } from '@nestjs/common';
import { TtsController } from './tts.controller';
import { TtsService } from './tts.service';
import { AuthGuard } from '../auth/auth.guard';

describe('TtsController', () => {
  let controller: TtsController;
  let ttsService: TtsService;

  const mockTtsService = {
    synthesize: jest.fn(),
  };

  const mockAuthGuard = {
    canActivate: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TtsController],
      providers: [{ provide: TtsService, useValue: mockTtsService }],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<TtsController>(TtsController);
    ttsService = module.get<TtsService>(TtsService);

    jest.clearAllMocks();
  });

  describe('synthesizeSpeech', () => {
    it('應該回傳 StreamableFile', async () => {
      const mockAudioBuffer = Buffer.from('mock audio data');
      mockTtsService.synthesize.mockResolvedValue(mockAudioBuffer);

      const result = await controller.synthesizeSpeech({ text: 'Hello' });

      expect(result).toBeInstanceOf(StreamableFile);
    });

    it('應該正確傳遞文字參數給 service', async () => {
      const mockAudioBuffer = Buffer.from('mock audio data');
      mockTtsService.synthesize.mockResolvedValue(mockAudioBuffer);

      await controller.synthesizeSpeech({ text: 'Hello world' });

      expect(ttsService.synthesize).toHaveBeenCalledWith('Hello world');
    });
  });
});
