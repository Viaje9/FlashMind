import { ConfigService } from '@nestjs/config';
import { InMemorySpeakingSessionStore } from './speaking-session.store';

describe('InMemorySpeakingSessionStore', () => {
  const createConfigService = (ttlSeconds: string = '1800') =>
    ({
      get: jest.fn((key: string) => {
        if (key === 'OPENAI_SPEAKING_SESSION_TTL_SECONDS') {
          return ttlSeconds;
        }
        return undefined;
      }),
    }) as unknown as ConfigService;

  it('應可儲存並讀取同一使用者會話', () => {
    const store = new InMemorySpeakingSessionStore(createConfigService());

    store.saveSession({
      userId: 'user-1',
      conversationId: 'conv-1',
      history: [{ role: 'assistant', text: 'hello' }],
    });

    expect(store.getSession('user-1', 'conv-1')).toEqual(
      expect.objectContaining({
        status: 'found',
      }),
    );
  });

  it('不同使用者讀取同一 conversationId 應回 forbidden', () => {
    const store = new InMemorySpeakingSessionStore(createConfigService());

    store.saveSession({
      userId: 'user-1',
      conversationId: 'conv-1',
      history: [{ role: 'assistant', text: 'hello' }],
    });

    expect(store.getSession('user-2', 'conv-1')).toEqual({
      status: 'forbidden',
    });
  });

  it('會話過期後應回 expired', () => {
    const dateNowSpy = jest.spyOn(Date, 'now');
    const store = new InMemorySpeakingSessionStore(createConfigService('1'));

    dateNowSpy.mockReturnValue(1_000);
    store.saveSession({
      userId: 'user-1',
      conversationId: 'conv-1',
      history: [{ role: 'assistant', text: 'hello' }],
    });

    dateNowSpy.mockReturnValue(2_100);
    expect(store.getSession('user-1', 'conv-1')).toEqual({
      status: 'expired',
    });

    dateNowSpy.mockRestore();
  });
});
