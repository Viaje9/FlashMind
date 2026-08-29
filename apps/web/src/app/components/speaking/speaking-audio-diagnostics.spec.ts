import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getSpeakingAudioDiagnostics,
  logSpeakingAudio,
  serializeSpeakingAudioDiagnostics,
  SPEAKING_AUDIO_DIAGNOSTICS_LIMIT,
} from './speaking-audio-diagnostics';

describe('speaking audio diagnostics', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  it('應將音訊事件持續保存到 localStorage', () => {
    vi.setSystemTime(new Date('2026-08-29T03:00:00.000Z'));

    logSpeakingAudio('playback.started', { itemId: 'item-1' });

    expect(getSpeakingAudioDiagnostics()).toEqual([
      {
        timestamp: '2026-08-29T03:00:00.000Z',
        event: 'playback.started',
        details: { itemId: 'item-1' },
      },
    ]);
  });

  it('超過上限時應保留最新的記錄', () => {
    for (let index = 0; index <= SPEAKING_AUDIO_DIAGNOSTICS_LIMIT; index += 1) {
      logSpeakingAudio(`event-${index}`);
    }

    const entries = getSpeakingAudioDiagnostics();
    expect(entries).toHaveLength(SPEAKING_AUDIO_DIAGNOSTICS_LIMIT);
    expect(entries[0]?.event).toBe('event-1');
    expect(entries.at(-1)?.event).toBe(`event-${SPEAKING_AUDIO_DIAGNOSTICS_LIMIT}`);
  });

  it('應產生可複製與匯出的 JSON', () => {
    logSpeakingAudio('realtime.connected', { attempt: 1 });

    const exported = JSON.parse(serializeSpeakingAudioDiagnostics()) as {
      version: number;
      entries: Array<{ event: string }>;
    };

    expect(exported.version).toBe(1);
    expect(exported.entries).toHaveLength(1);
    expect(exported.entries[0]?.event).toBe('realtime.connected');
  });
});
