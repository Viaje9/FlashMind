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

  it('應將診斷記錄上限設定為五萬筆', () => {
    expect(SPEAKING_AUDIO_DIAGNOSTICS_LIMIT).toBe(50_000);
  });

  it('localStorage 容量不足時應刪除最舊記錄並保留最新事件', () => {
    const originalSetItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      const entries = JSON.parse(value) as unknown[];
      if (entries.length > 2) {
        throw new DOMException('容量不足', 'QuotaExceededError');
      }
      originalSetItem(key, value);
    });

    logSpeakingAudio('event-1');
    logSpeakingAudio('event-2');
    logSpeakingAudio('event-3');

    expect(getSpeakingAudioDiagnostics().map((entry) => entry.event)).toEqual([
      'event-2',
      'event-3',
    ]);
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
