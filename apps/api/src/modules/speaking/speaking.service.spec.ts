import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SpeakingService } from './speaking.service';

describe('SpeakingService', () => {
  let service: SpeakingService;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;

    const configService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          OPENAI_API_KEY: 'test-openai-key',
          OPENAI_SPEAKING_MODEL: 'gpt-4o-mini',
          OPENAI_SPEAKING_TEXT_MODEL: 'gpt-4o-mini',
          OPENAI_SPEAKING_AUDIO_MODEL: 'gpt-4o-mini-audio-preview',
          OPENAI_SPEAKING_DEFAULT_VOICE: 'nova',
        };
        return config[key];
      }),
    } as unknown as ConfigService;

    service = new SpeakingService(configService);
  });

  it('createReply 應成功回傳 reply 與 usage', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          model: 'gpt-4o-mini',
          choices: [
            { message: { content: 'Nice to meet you. What do you do?' } },
          ],
          usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
        }),
    });

    const result = await service.createReply({
      message: 'Hello',
      history: [{ role: 'assistant', content: 'Hi!' }],
    });

    expect(result.reply).toBe('Nice to meet you. What do you do?');
    expect(result.model).toBe('gpt-4o-mini');
    expect(result.usage.totalTokens).toBe(18);
  });

  it('createAudioReply 應回傳 transcript、audio 與 memoryUpdate', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          model: 'gpt-4o-mini-audio-preview',
          choices: [
            {
              message: {
                audio: {
                  transcript: 'Great! What did you do today?',
                  data: 'BASE64_AUDIO',
                },
                tool_calls: [
                  {
                    type: 'function',
                    function: {
                      name: 'update_memory',
                      arguments: JSON.stringify({
                        memory: 'User likes jogging.',
                        reason: 'Stable habit',
                      }),
                    },
                  },
                ],
              },
            },
          ],
          usage: {
            prompt_tokens: 20,
            completion_tokens: 12,
            total_tokens: 32,
            prompt_tokens_details: { text_tokens: 5, audio_tokens: 15 },
            completion_tokens_details: { text_tokens: 4, audio_tokens: 8 },
          },
        }),
    });

    const result = await service.createAudioReply({
      audioBuffer: Buffer.from('audio-bytes'),
      history: [{ role: 'assistant', text: 'Hi there' }],
      autoMemoryEnabled: true,
    });

    expect(result.transcript).toBe('Great! What did you do today?');
    expect(result.audioBase64).toBe('BASE64_AUDIO');
    expect(result.memoryUpdate?.memory).toBe('User likes jogging.');
    expect(result.usage.promptAudioTokens).toBe(15);
  });

  it('createAudioReply 應忽略非 wav 的歷史音訊並退回文字內容', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          model: 'gpt-4o-mini-audio-preview',
          choices: [
            {
              message: {
                audio: {
                  transcript: 'Sounds good.',
                  data: 'BASE64_AUDIO',
                },
              },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
    });

    await service.createAudioReply({
      audioBuffer: Buffer.from('RIFF-test-wav'),
      history: [
        {
          role: 'user',
          audioBase64: 'GkXfWEBM_HEADER',
          text: 'fallback text',
        },
      ],
    });

    const requestBody = JSON.parse(
      fetchMock.mock.calls[0][1].body as string,
    ) as {
      messages: Array<{ role: string; content: unknown }>;
    };
    const userHistory = requestBody.messages.find(
      (item) => item.role === 'user',
    );

    expect(userHistory).toBeDefined();
    expect(userHistory?.content).toBe('fallback text');
  });

  it('summarizeConversation 應回傳 title 與 summary', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: '晨跑與工作日常',
                  summary: 'I jogged in the morning and then went to work.',
                }),
              },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 6, total_tokens: 16 },
        }),
    });

    const result = await service.summarizeConversation([
      { role: 'user', audioBase64: 'abc' },
      { role: 'assistant', text: 'Nice job' },
    ]);

    expect(result.title).toBe('晨跑與工作日常');
    expect(result.summary).toContain('jogged');
  });

  it('translateToTraditionalChinese 應回傳翻譯', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: '你好，我今天很開心。' } }],
          usage: { prompt_tokens: 8, completion_tokens: 5, total_tokens: 13 },
        }),
    });

    const result = await service.translateToTraditionalChinese(
      'Hello, I am happy today.',
    );
    expect(result.translatedText).toBe('你好，我今天很開心。');
  });

  it('chatAssistant 應回傳 assistant reply', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          model: 'gpt-4o-mini',
          choices: [{ message: { content: '你可以用 present perfect。' } }],
          usage: { prompt_tokens: 8, completion_tokens: 5, total_tokens: 13 },
        }),
    });

    const result = await service.chatAssistant({
      message: 'present perfect 怎麼用？',
      history: [{ role: 'user', content: '我想問文法' }],
    });

    expect(result.reply).toBe('你可以用 present perfect。');
  });

  it('previewVoice 應回傳 base64 音訊', async () => {
    const audioBytes = Uint8Array.from([1, 2, 3, 4]);
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(audioBytes.buffer),
    });

    const result = await service.previewVoice('nova');

    expect(result.audioBase64).toBe(Buffer.from(audioBytes).toString('base64'));
  });

  it('OpenAI 非 2xx 時應拋 AI_SERVICE_ERROR', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('upstream error'),
    });

    await expect(
      service.createReply({
        message: 'Hello',
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
