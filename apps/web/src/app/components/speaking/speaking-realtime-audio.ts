import { normalizeBase64 } from './speaking-audio.utils';

export async function pcm16Base64FromWav(blob: Blob): Promise<string> {
  const buffer = await readBlobAsArrayBuffer(blob);
  const bytes = new Uint8Array(buffer);
  const dataOffset = findWavDataOffset(bytes);
  return bytesToBase64(bytes.subarray(dataOffset));
}

export async function wavPcm16DurationSeconds(blob: Blob): Promise<number> {
  const buffer = await readBlobAsArrayBuffer(blob);
  const bytes = new Uint8Array(buffer);
  const dataOffset = findWavDataOffset(bytes);
  const view = new DataView(buffer);
  const sampleRate = view.getUint32(24, true);
  const channelCount = view.getUint16(22, true);
  const bitsPerSample = view.getUint16(34, true);
  const bytesPerSecond = sampleRate * channelCount * (bitsPerSample / 8);
  return bytesPerSecond > 0 ? (bytes.byteLength - dataOffset) / bytesPerSecond : 0;
}

function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('讀取音訊失敗'));
    reader.readAsArrayBuffer(blob);
  });
}

export function wavBlobFromPcm16Base64(chunks: readonly string[], sampleRate: number): Blob {
  const pcmChunks = chunks.map((chunk) => base64ToBytes(chunk));
  const dataSize = pcmChunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const output = new Uint8Array(buffer);
  let offset = 44;
  for (const chunk of pcmChunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function findWavDataOffset(bytes: Uint8Array): number {
  if (bytes.byteLength < 44 || new TextDecoder().decode(bytes.slice(0, 4)) !== 'RIFF') {
    throw new Error('Realtime audio 必須是 WAV PCM16');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.byteLength) {
    const chunkId = new TextDecoder().decode(bytes.slice(offset, offset + 4));
    const chunkSize = view.getUint32(offset + 4, true);
    if (chunkId === 'data') {
      return offset + 8;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  throw new Error('WAV 找不到 data chunk');
}

function base64ToBytes(raw: string): Uint8Array {
  const binary = atob(normalizeBase64(raw));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const batchSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += batchSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + batchSize));
  }
  return btoa(binary);
}

function writeString(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
