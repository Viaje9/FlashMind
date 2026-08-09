import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SpeakingService } from './speaking.service';

function createResponsesStream(
  events: Array<{ type: string; [key: string]: unknown }>,
): ReadableStream<Uint8Array> {
  const payload = events
    .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
    .join('');
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(payload));
      controller.close();
    },
  });
}

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

  it('Speaking 文字端點應優先使用 COLLECTION_AGENTS_MODEL', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          model: 'gpt-5.6-luna',
          choices: [{ message: { content: 'Hello!' } }],
          usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
        }),
    });

    const configService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          OPENAI_API_KEY: 'test-openai-key',
          OPENAI_SPEAKING_TEXT_MODEL: 'gpt-4o-mini',
          COLLECTION_AGENTS_MODEL: 'gpt-5.6-luna',
        };
        return config[key];
      }),
    } as unknown as ConfigService;
    service = new SpeakingService(configService);

    await service.createReply({ message: 'Hi' });

    const requestBody = JSON.parse(
      fetchMock.mock.calls[0][1].body as string,
    ) as {
      model: string;
    };
    expect(requestBody.model).toBe('gpt-5.6-luna');
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

    const requestBody = JSON.parse(
      fetchMock.mock.calls[0][1].body as string,
    ) as {
      messages: Array<{ role: string; content: string }>;
      temperature?: number;
    };

    const systemPrompt = requestBody.messages.find(
      (item) => item.role === 'system',
    )?.content;
    const summarizePrompt =
      requestBody.messages[requestBody.messages.length - 1]?.content;

    expect(requestBody.temperature).toBe(0.2);
    expect(systemPrompt).toContain('"summary" must be English only');
    expect(systemPrompt).toContain(
      '"title" must be Traditional Chinese (繁體中文)',
    );
    expect(summarizePrompt).toContain(
      'Write the "summary" field in English only',
    );
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
          output_text: '你可以用 present perfect。',
          usage: { input_tokens: 8, output_tokens: 5, total_tokens: 13 },
        }),
    });

    const result = await service.chatAssistant({
      message: 'present perfect 怎麼用？',
      history: [{ role: 'user', content: '我想問文法' }],
    });

    expect(result.reply).toBe('你可以用 present perfect。');
  });

  it('chatAssistantStream 應逐段回傳文字事件', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      body: createResponsesStream([
        { type: 'response.output_text.delta', delta: '你可以先用 ' },
        { type: 'response.output_text.delta', delta: 'present perfect。' },
        {
          type: 'response.completed',
          response: {
            model: 'gpt-5.6-luna',
            output: [
              {
                type: 'message',
                content: [
                  { type: 'output_text', text: '你可以先用 present perfect。' },
                ],
              },
            ],
            usage: { input_tokens: 8, output_tokens: 5, total_tokens: 13 },
          },
        },
      ]),
    });

    const events: Array<{ type: string; delta?: string }> = [];
    const result = await service.chatAssistantStream(
      { message: 'present perfect 怎麼用？', effort: 'none' },
      undefined,
      (event) => events.push(event),
    );

    expect(result.reply).toBe('你可以先用 present perfect。');
    expect(events).toEqual([
      { type: 'text_delta', delta: '你可以先用 ' },
      { type: 'text_delta', delta: 'present perfect。' },
    ]);
    const requestBody = JSON.parse(
      fetchMock.mock.calls[0][1].body as string,
    ) as { stream?: boolean };
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.openai.com/v1/responses',
    );
    expect(requestBody.stream).toBe(true);
  });

  it('chatAssistant 應使用工具查詢使用者單字熟練度', async () => {
    const card = {
      front: 'sue',
      state: 'REVIEW',
      due: new Date('2026-08-11T00:00:00.000Z'),
      stability: 2,
      difficulty: 3,
      elapsedDays: 1,
      scheduledDays: 2,
      reps: 2,
      lapses: 0,
      lastReview: new Date('2026-08-09T00:00:00.000Z'),
      learningStep: 0,
      reverseState: 'NEW',
      reverseDue: null,
      reverseStability: null,
      reverseDifficulty: null,
      reverseElapsedDays: 0,
      reverseScheduledDays: 0,
      reverseReps: 0,
      reverseLapses: 0,
      reverseLastReview: null,
      reverseLearningStep: 0,
      deck: { name: '英文牌組' },
      meanings: [{ zhMeaning: '控告', enExample: 'They sued the company.' }],
    };
    const prisma = {
      card: { findMany: jest.fn().mockResolvedValue([card]) },
    };
    const fsrsService = {
      calculateRetrievability: jest.fn().mockReturnValue(0.85),
      calculateProficiency: jest.fn().mockReturnValue('FAIR'),
    };
    const configService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          OPENAI_API_KEY: 'test-openai-key',
          OPENAI_SPEAKING_TEXT_MODEL: 'gpt-4o-mini',
          COLLECTION_AGENTS_MODEL: 'gpt-5.6-luna',
        };
        return config[key];
      }),
    } as unknown as ConfigService;
    service = new SpeakingService(
      configService,
      prisma as never,
      fsrsService as never,
    );

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            model: 'gpt-4o-mini',
            output: [
              {
                type: 'function_call',
                call_id: 'call_proficiency',
                name: 'get_word_proficiency',
                arguments: JSON.stringify({ word: 'sue' }),
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            model: 'gpt-4o-mini',
            output_text: 'sue 目前熟練度是 FAIR。',
          }),
      });

    const result = await service.chatAssistant(
      { message: 'sue 的熟練度如何？', effort: 'high' },
      'user-1',
    );

    expect(result.reply).toBe('sue 目前熟練度是 FAIR。');
    expect(result.toolCalls).toEqual([{ name: 'get_word_proficiency' }]);
    expect(prisma.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deck: { userId: 'user-1' } }),
      }),
    );
    const secondRequest = JSON.parse(
      fetchMock.mock.calls[1][1].body as string,
    ) as {
      input: Array<{ type?: string; role?: string; output?: string }>;
    };
    const firstRequest = JSON.parse(
      fetchMock.mock.calls[0][1].body as string,
    ) as {
      model: string;
      reasoning?: { effort?: string };
    };
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.openai.com/v1/responses',
    );
    expect(firstRequest.model).toBe('gpt-5.6-luna');
    expect(firstRequest.reasoning?.effort).toBe('high');
    expect(
      secondRequest.input.some((item) => item.type === 'function_call_output'),
    ).toBe(true);
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
