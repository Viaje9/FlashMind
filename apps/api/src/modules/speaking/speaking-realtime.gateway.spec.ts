import { ConfigService } from '@nestjs/config';
import { SpeakingRealtimeGateway } from './speaking-realtime.gateway';

describe('SpeakingRealtimeGateway', () => {
  it('應建立 Realtime session 設定並啟用輸入轉錄', () => {
    const configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          OPENAI_API_KEY: 'test-key',
          OPENAI_SPEAKING_AUDIO_MODEL: 'gpt-realtime-2.1-mini',
        };
        return values[key];
      }),
    } as unknown as ConfigService;
    const gateway = new SpeakingRealtimeGateway(
      configService,
      { httpAdapter: null } as never,
      { validateSession: jest.fn() } as never,
    );

    const event = gateway.buildSessionUpdate({
      voice: 'marin',
      instructions: 'Speak naturally.',
      autoMemoryEnabled: true,
      lastPractice: {
        title: '與 AI 協作流程',
        summary: 'I explained how I work with an AI agent.',
      },
      nextPractice: {
        topic: 'How I work with an AI agent',
        speakingGoal: 'Explain one collaboration workflow.',
        guidingQuestions: ['What do you ask the AI to do first?'],
        recallTargets: ['cooperation', 'function'],
      },
    });

    expect(event).toMatchObject({
      type: 'session.update',
      session: {
        type: 'realtime',
        model: 'gpt-realtime-2.1-mini',
        output_modalities: ['audio'],
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: 24000 },
            transcription: { model: 'gpt-transcribe' },
            turn_detection: null,
          },
          output: {
            format: { type: 'audio/pcm', rate: 24000 },
            voice: 'marin',
          },
        },
        tools: [
          expect.objectContaining({
            type: 'function',
            name: 'update_memory',
          }),
        ],
      },
    });
    expect(
      (event['session'] as { instructions?: string }).instructions,
    ).toContain('Previous conversation context');
    expect(
      (event['session'] as { instructions?: string }).instructions,
    ).toContain('I explained how I work with an AI agent.');
    expect(
      (event['session'] as { instructions?: string }).instructions,
    ).toContain(
      'If the user asks what you discussed last time, answer directly',
    );
    expect(
      (event['session'] as { instructions?: string }).instructions,
    ).toContain('Next practice context (private guidance)');
    expect(
      (event['session'] as { instructions?: string }).instructions,
    ).toContain('How I work with an AI agent');
    expect(
      (event['session'] as { instructions?: string }).instructions,
    ).toContain('Never quiz the user or force these words');
  });

  it('真即時模式應啟用 Server VAD、自動回覆與打斷', () => {
    const configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          OPENAI_API_KEY: 'test-key',
          OPENAI_SPEAKING_AUDIO_MODEL: 'gpt-realtime-2.1-mini',
        };
        return values[key];
      }),
    } as unknown as ConfigService;
    const gateway = new SpeakingRealtimeGateway(
      configService,
      { httpAdapter: null } as never,
      { validateSession: jest.fn() } as never,
    );

    const event = gateway.buildSessionUpdate({
      voice: 'marin',
      interactionMode: 'FULL_DUPLEX',
    });

    expect(event).toMatchObject({
      session: {
        audio: {
          input: {
            turn_detection: {
              type: 'server_vad',
              create_response: true,
              interrupt_response: true,
            },
          },
        },
      },
    });
  });
});
