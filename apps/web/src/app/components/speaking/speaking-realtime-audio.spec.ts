import {
  pcm16Base64FromWav,
  wavBlobFromPcm16Base64,
  wavPcm16DurationSeconds,
} from './speaking-realtime-audio';

describe('speaking-realtime-audio', () => {
  it('應移除 WAV header 後輸出 PCM16 base64', async () => {
    const bytes = new Uint8Array(48);
    bytes.set([82, 73, 70, 70], 0);
    bytes.set([87, 65, 86, 69], 8);
    bytes.set([100, 97, 116, 97], 36);
    new DataView(bytes.buffer).setUint32(40, 4, true);
    bytes.set([1, 2, 3, 4], 44);

    await expect(pcm16Base64FromWav(new Blob([bytes], { type: 'audio/wav' }))).resolves.toBe(
      'AQIDBA==',
    );
  });

  it('應把 PCM16 base64 包裝成可播放 WAV', async () => {
    const blob = wavBlobFromPcm16Base64(['AQIDBA=='], 24000);
    const bytes = new Uint8Array(await readBlob(blob));

    expect(blob.type).toBe('audio/wav');
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('RIFF');
    expect(new DataView(bytes.buffer).getUint32(24, true)).toBe(24000);
    expect(Array.from(bytes.slice(44))).toEqual([1, 2, 3, 4]);
  });

  it('應依 WAV PCM 資訊計算轉錄秒數', async () => {
    const blob = wavBlobFromPcm16Base64(
      [btoa(String.fromCharCode(...new Uint8Array(32000)))],
      16000,
    );

    await expect(wavPcm16DurationSeconds(blob)).resolves.toBe(1);
  });
});

function readBlob(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}
