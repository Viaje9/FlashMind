import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeakingAudioPlayerService } from './speaking-audio-player.service';

class MockAudio {
  static playResults: Array<'ok' | Error> = [];
  static instances: MockAudio[] = [];
  static autoEnd = true;

  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  currentTime = 0;
  paused = true;

  readonly play = vi.fn(async () => {
    this.paused = false;
    const next = MockAudio.playResults.shift() ?? 'ok';
    if (next instanceof Error) {
      this.paused = true;
      throw next;
    }

    if (MockAudio.autoEnd) {
      window.setTimeout(() => {
        this.paused = true;
        this.onended?.();
      }, 0);
    }
  });

  readonly pause = vi.fn(() => {
    this.paused = true;
  });

  constructor(public readonly src: string) {
    MockAudio.instances.push(this);
  }

  triggerEnd(): void {
    this.paused = true;
    this.onended?.();
  }
}

describe('speaking-audio-player.service', () => {
  const createObjectURL = vi.fn(() => 'blob:mock');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    MockAudio.playResults = [];
    MockAudio.instances = [];
    MockAudio.autoEnd = true;
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
    await new Promise((resolve) => setTimeout(resolve, 0));

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

  it('同一則音訊重複點擊應在播放與暫停間切換', async () => {
    MockAudio.autoEnd = false;
    const service = new SpeakingAudioPlayerService();
    const blob = new Blob(['audio']);

    await service.play(blob, 'assistant-3');
    expect(service.playingKey()).toBe('assistant-3');
    expect(service.pausedKey()).toBeNull();

    await service.play(blob, 'assistant-3');
    expect(service.playingKey()).toBeNull();
    expect(service.pausedKey()).toBe('assistant-3');

    await service.play(blob, 'assistant-3');
    expect(service.playingKey()).toBe('assistant-3');
    expect(service.pausedKey()).toBeNull();

    MockAudio.instances[0]?.triggerEnd();
    expect(service.playingKey()).toBeNull();
    expect(service.pausedKey()).toBeNull();
  });
});
