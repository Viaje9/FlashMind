import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '../auth/auth.guard';
import { WhitelistGuard } from '../auth/whitelist.guard';
import { SpeakingController } from './speaking.controller';
import { SpeakingService } from './speaking.service';

describe('SpeakingController', () => {
  let controller: SpeakingController;
  let speakingService: SpeakingService;

  const mockSpeakingService = {
    createReply: jest.fn(),
    createAudioReply: jest.fn(),
    summarizeConversation: jest.fn(),
    translateToTraditionalChinese: jest.fn(),
    chatAssistant: jest.fn(),
    previewVoice: jest.fn(),
  };

  const mockGuard = {
    canActivate: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SpeakingController],
      providers: [{ provide: SpeakingService, useValue: mockSpeakingService }],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockGuard)
      .overrideGuard(WhitelistGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<SpeakingController>(SpeakingController);
    speakingService = module.get<SpeakingService>(SpeakingService);

    jest.clearAllMocks();
  });

  it('createSpeakingReply 應回傳 data wrapper', async () => {
    const mockResult = {
      reply: 'Great! What did you do today?',
      model: 'gpt-4o-mini',
      usage: { promptTokens: 10, completionTokens: 8, totalTokens: 18 },
    };
    mockSpeakingService.createReply.mockResolvedValue(mockResult);

    const result = await controller.createSpeakingReply({
      message: 'Hello',
      history: [],
    });

    expect(speakingService.createReply).toHaveBeenCalledWith({
      message: 'Hello',
      history: [],
    });
    expect(result).toEqual({ data: mockResult });
  });

  it('createSpeakingAudioReply 應回傳 data wrapper', async () => {
    const mockResult = {
      transcript: 'Hello there',
      audioBase64: 'AUDIO',
      model: 'gpt-4o-mini-audio-preview',
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
    };
    mockSpeakingService.createAudioReply.mockResolvedValue(mockResult);

    const result = await controller.createSpeakingAudioReply(
      { buffer: Buffer.from('audio') } as Express.Multer.File,
      {
        history: JSON.stringify([{ role: 'assistant', text: 'Hi!' }]),
        voice: 'nova',
        autoMemoryEnabled: 'true',
      },
    );

    expect(speakingService.createAudioReply).toHaveBeenCalled();
    expect(result).toEqual({ data: mockResult });
  });

  it('createSpeakingAudioReply 缺少檔案時應拋 400', async () => {
    await expect(
      controller.createSpeakingAudioReply(
        undefined as unknown as Express.Multer.File,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('summarize 應回傳 data wrapper', async () => {
    mockSpeakingService.summarizeConversation.mockResolvedValue({
      title: '摘要標題',
      summary: '摘要內容',
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
    });

    const result = await controller.summarize({ history: [] });
    expect(result).toHaveProperty('data');
  });

  it('translate 應回傳 data wrapper', async () => {
    mockSpeakingService.translateToTraditionalChinese.mockResolvedValue({
      translatedText: '你好',
    });

    const result = await controller.translate({ text: 'hello' });
    expect(result).toEqual({ data: { translatedText: '你好' } });
  });

  it('assistantChat 應回傳 data wrapper', async () => {
    mockSpeakingService.chatAssistant.mockResolvedValue({
      reply: '回答',
      model: 'gpt-4o-mini',
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
    });

    const result = await controller.assistantChat({
      message: 'hi',
      history: [],
    });
    expect(result).toHaveProperty('data');
  });

  it('previewVoice 應回傳 data wrapper', async () => {
    mockSpeakingService.previewVoice.mockResolvedValue({
      audioBase64: 'AUDIO',
    });

    const result = await controller.previewVoice({ voice: 'nova' });
    expect(result).toEqual({ data: { audioBase64: 'AUDIO' } });
  });
});
