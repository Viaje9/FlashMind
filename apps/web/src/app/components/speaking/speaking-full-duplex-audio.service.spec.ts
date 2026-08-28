import { describe, expect, it, vi } from 'vitest';
import { resamplePcm16Base64 } from './speaking-full-duplex-audio.service';

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
});
