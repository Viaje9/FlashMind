import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeakingAudioPlayerService } from './speaking-audio-player.service';

class MockAudio {
  static playResults: Array<'ok' | Error> = [];

  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  currentTime = 0;

  readonly play = vi.fn(async () => {
    const next = MockAudio.playResults.shift() ?? 'ok';
    if (next instanceof Error) {
      throw next;
    }

    window.setTimeout(() => {
      this.onended?.();
    }, 0);
  });

  readonly pause = vi.fn(() => undefined);

  constructor(public readonly src: string) {}
}

describe('speaking-audio-player.service', () => {
  const createObjectURL = vi.fn(() => 'blob:mock');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    MockAudio.playResults = [];
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();

    vi.stubGlobal('window', {
      setTimeout,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('Audio', MockAudio as unknown as typeof Audio);
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('auto 模式應在首次播放失敗後重試並成功', async () => {
    MockAudio.playResults = [new Error('autoplay blocked'), 'ok'];
    const service = new SpeakingAudioPlayerService();

    await service.play(new Blob(['audio']), 'assistant-1', {
      auto: true,
      maxRetryAttempts: 2,
    });

    expect(service.error()).toBeNull();
    expect(service.playingKey()).toBeNull();
  });

  it('auto 模式重試後仍失敗時應設置可理解錯誤訊息', async () => {
    MockAudio.playResults = [new Error('blocked'), new Error('blocked-again')];
    const service = new SpeakingAudioPlayerService();

    await service.play(new Blob(['audio']), 'assistant-2', {
      auto: true,
      maxRetryAttempts: 2,
    });

    expect(service.error()).toBe('語音播放失敗，請再試一次。');
    expect(service.playingKey()).toBeNull();
  });
});
