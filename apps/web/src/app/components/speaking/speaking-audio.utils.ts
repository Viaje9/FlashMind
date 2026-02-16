export function detectAudioMimeFromBase64(rawBase64: string): string {
  const base64 = normalizeBase64(rawBase64);
  const head = base64.slice(0, 24);

  if (head.startsWith('UklGR')) return 'audio/wav';
  if (head.startsWith('SUQz') || head.startsWith('/+MY') || head.startsWith('//uQ'))
    return 'audio/mpeg';
  if (head.startsWith('T2dnUw')) return 'audio/ogg';
  if (head.startsWith('fLaC')) return 'audio/flac';
  if (head.startsWith('AAAAFGZ0eXA')) return 'audio/mp4';

  return 'audio/wav';
}

export function normalizeBase64(raw: string): string {
  const trimmed = raw.trim();
  const marker = 'base64,';
  const markerIndex = trimmed.indexOf(marker);

  if (markerIndex >= 0) {
    return trimmed.slice(markerIndex + marker.length);
  }

  return trimmed;
}

export function base64ToBlob(rawBase64: string): Blob {
  const base64 = normalizeBase64(rawBase64);
  const mimeType = detectAudioMimeFromBase64(base64);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mimeType });
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const data = await blob.arrayBuffer();
  const bytes = new Uint8Array(data);
  let binary = '';

  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

export async function blobToWavBlob(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext({ sampleRate: 16000 });

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const wavArrayBuffer = encodeWav(audioBuffer);
    return new Blob([wavArrayBuffer], { type: 'audio/wav' });
  } finally {
    await audioContext.close();
  }
}

function encodeWav(audioBuffer: AudioBuffer): ArrayBuffer {
  const numChannels = 1;
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.getChannelData(0);
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

function writeString(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}
