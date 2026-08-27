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
          COLLECTION_CODEX_MODEL: 'gpt-5.6-luna',
          COLLECTION_CODEX_REASONING_EFFORT: 'low',
          OPENAI_SPEAKING_AUDIO_MODEL: 'gpt-realtime-2.1-mini',
          OPENAI_SPEAKING_DEFAULT_VOICE: 'marin',
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
    const requestBody = JSON.parse(
      fetchMock.mock.calls[0][1].body as string,
    ) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(requestBody.messages[0].content).toContain(
      'Respond to what the user is talking about, not to the quality of their English',
    );
    expect(requestBody.messages[0].content).toContain(
      'After helping, return directly to the original conversation',
    );
  });

  it('Speaking 文字端點應使用 COLLECTION_CODEX_MODEL', async () => {
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
          COLLECTION_CODEX_MODEL: 'gpt-5.6-luna',
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
      temperature?: number;
    };
    expect(requestBody.model).toBe('gpt-5.6-luna');
    expect(requestBody.temperature).toBeUndefined();
  });

  it('createAudioReply 應回傳 transcript、audio 與 memoryUpdate', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          model: 'gpt-realtime-2.1-mini',
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
          model: 'gpt-realtime-2.1-mini',
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

  it('summarizeConversation 應只套用目標清單內的實際使用與推薦，並產生下次練習', async () => {
    const targetVocabularyService = {
      listReviewCandidates: jest.fn().mockResolvedValue([
        {
          term: 'function',
          normalizedTerm: 'function',
          zhMeaning: '功能',
          status: 'UNSEEN',
        },
        {
          term: 'cooperation',
          normalizedTerm: 'cooperation',
          zhMeaning: '合作；協作',
          status: 'UNSEEN',
        },
      ]),
      applyReview: jest.fn().mockResolvedValue(undefined),
    };
    const configService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          OPENAI_API_KEY: 'test-openai-key',
          COLLECTION_CODEX_MODEL: 'gpt-5.6-luna',
          COLLECTION_CODEX_REASONING_EFFORT: 'low',
        };
        return config[key];
      }),
    } as unknown as ConfigService;
    service = new SpeakingService(
      configService,
      undefined,
      undefined,
      targetVocabularyService as never,
    );
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
                  review: '你有清楚說明先運動再工作的順序。',
                  actualUses: [
                    {
                      term: 'function',
                      expressionContext: '描述 node tree 所需的功能。',
                      naturalSentence:
                        'It depends on what kind of function the node tree needs.',
                    },
                    {
                      term: 'hallucinated',
                      expressionContext: '不在目標清單。',
                      naturalSentence: 'This should be ignored.',
                    },
                  ],
                  recommendations: [
                    {
                      term: 'cooperation',
                      expressionContext: '描述與 AI 一起工作的方式。',
                      naturalSentence:
                        'This is cooperation between me and the AI agent.',
                      recommendationReason: '適合本次談到的 AI 協作情境。',
                    },
                  ],
                  nextPractice: {
                    topic: 'How I work with an AI agent',
                    speakingGoal: 'Explain one real collaboration workflow.',
                    guidingQuestions: [
                      'What do you ask the AI to do first?',
                      'How do you check the first draft?',
                    ],
                    recallTargets: ['cooperation', 'function'],
                  },
                }),
              },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 6, total_tokens: 16 },
        }),
    });

    const result = await service.summarizeConversation(
      [
        {
          role: 'user',
          text: 'It depends on what kind of function the node tree needs.',
          audioBase64: 'abc',
        },
        { role: 'assistant', text: 'Nice job' },
      ],
      'user-1',
    );

    expect(result.title).toBe('晨跑與工作日常');
    expect(result.summary).toContain('jogged');
    expect(result.actualUses).toEqual([
      expect.objectContaining({ term: 'function', zhMeaning: '功能' }),
    ]);
    expect(result.recommendations).toEqual([
      expect.objectContaining({
        term: 'cooperation',
        zhMeaning: '合作；協作',
      }),
    ]);
    expect(result.nextPractice.topic).toBe('How I work with an AI agent');
    expect(targetVocabularyService.applyReview).toHaveBeenCalledWith('user-1', {
      actualUses: [expect.objectContaining({ term: 'function' })],
      recommendations: [expect.objectContaining({ term: 'cooperation' })],
    });

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

    expect(requestBody.temperature).toBeUndefined();
    expect(systemPrompt).toContain('Analyze only what the USER actually said');
    expect(summarizePrompt).toContain('function | 功能 | UNSEEN');
    expect(summarizePrompt).toContain(
      'An assistant saying, repeating, or explaining a word does not count',
    );
    expect(JSON.stringify(requestBody.messages)).not.toContain('input_audio');
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
          COLLECTION_CODEX_MODEL: 'gpt-5.6-luna',
          COLLECTION_CODEX_REASONING_EFFORT: 'low',
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

    const result = await service.previewVoice('marin');

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
