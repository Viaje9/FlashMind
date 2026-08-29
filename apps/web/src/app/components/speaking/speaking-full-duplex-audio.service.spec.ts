import { describe, expect, it, vi } from 'vitest';
import {
  SpeakingFullDuplexAudioService,
  resamplePcm16Base64,
} from './speaking-full-duplex-audio.service';

describe('speaking-full-duplex-audio', () => {
  it('應將瀏覽器浮點取樣轉成 24 kHz PCM16 base64', () => {
    vi.stubGlobal('btoa', (value: string) => Buffer.from(value, 'binary').toString('base64'));
    const input = new Float32Array(48_000).fill(0.5);

    const result = resamplePcm16Base64(input, 48_000);
    const bytes = Buffer.from(result, 'base64');

    expect(bytes.byteLength).toBe(24_000 * 2);
    expect(bytes.readInt16LE(0)).toBeGreaterThan(16_000);
    vi.unstubAllGlobals();
  });

  it('應分別記錄使用者與 AI 聲音的靜音狀態', () => {
    const service = new SpeakingFullDuplexAudioService();

    service.setInputMuted(true);
    service.setOutputMuted(true);

    expect(service.inputMuted()).toBe(true);
    expect(service.outputMuted()).toBe(true);
  });

  it('新的 AI item 應接在尚未播放完成的 item 後方，不可重疊播放', () => {
    const starts: number[] = [];
    const context = {
      currentTime: 10,
      destination: {},
      createBuffer: vi.fn(() => ({
        duration: 0.4,
        getChannelData: () => new Float32Array(2),
      })),
      createBufferSource: vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        start: (startsAt: number) => starts.push(startsAt),
        stop: vi.fn(),
        onended: null,
      })),
    };
    const service = new SpeakingFullDuplexAudioService();
    (
      service as unknown as {
        audioContext: typeof context;
      }
    ).audioContext = context;

    service.beginAssistantItem('item-1');
    service.playPcm16Chunk('AAAAAA==');
    context.currentTime = 10.1;
    service.beginAssistantItem('item-2');
    service.playPcm16Chunk('AAAAAA==');

    expect(starts).toEqual([10, 10.4]);
  });
});
