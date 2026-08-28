import { Injectable, computed, signal } from '@angular/core';

export function resamplePcm16Base64(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate = 24_000,
): string {
  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const bytes = new Uint8Array(outputLength * 2);
  const view = new DataView(bytes.buffer);

  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = index * ratio;
    const left = Math.floor(sourceIndex);
    const right = Math.min(input.length - 1, left + 1);
    const fraction = sourceIndex - left;
    const sample = Math.max(
      -1,
      Math.min(1, input[left] * (1 - fraction) + input[right] * fraction),
    );
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export interface InterruptedPlayback {
  itemId: string;
  audioEndMs: number;
}

@Injectable({ providedIn: 'root' })
export class SpeakingFullDuplexAudioService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private silentGain: GainNode | null = null;
  private readonly scheduledSources = new Set<AudioBufferSourceNode>();
  private nextPlaybackAt = 0;
  private playbackStartedAt: number | null = null;
  private currentAssistantItemId: string | null = null;

  private readonly activeState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly active = computed(() => this.activeState());
  readonly error = computed(() => this.errorState());

  async start(onAudioChunk: (base64Pcm16: string) => void): Promise<void> {
    this.stop();
    this.errorState.set(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const context = new AudioContext();
      if (context.state !== 'running') await context.resume();

      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const silentGain = context.createGain();
      silentGain.gain.value = 0;

      processor.onaudioprocess = (event) => {
        if (!this.activeState()) return;
        const samples = event.inputBuffer.getChannelData(0);
        onAudioChunk(resamplePcm16Base64(samples, context.sampleRate));
      };

      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(context.destination);

      this.audioContext = context;
      this.mediaStream = stream;
      this.inputSource = source;
      this.processor = processor;
      this.silentGain = silentGain;
      this.activeState.set(true);
    } catch {
      this.stop();
      this.errorState.set('無法啟動真即時語音，請確認麥克風權限後再試。');
      throw new Error(this.errorState() ?? '無法啟動真即時語音');
    }
  }

  beginAssistantItem(itemId: string): void {
    this.currentAssistantItemId = itemId;
    this.playbackStartedAt = null;
    this.nextPlaybackAt = this.audioContext?.currentTime ?? 0;
  }

  playPcm16Chunk(base64: string): void {
    const context = this.audioContext;
    if (!context || !base64) return;

    const binary = atob(base64);
    const sampleCount = Math.floor(binary.length / 2);
    if (sampleCount === 0) return;

    const buffer = context.createBuffer(1, sampleCount, 24_000);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index += 1) {
      const low = binary.charCodeAt(index * 2);
      const high = binary.charCodeAt(index * 2 + 1);
      const signed = (high << 8) | low;
      channel[index] = (signed & 0x8000 ? signed - 0x10000 : signed) / 0x8000;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => this.scheduledSources.delete(source);

    const startsAt = Math.max(context.currentTime, this.nextPlaybackAt);
    this.playbackStartedAt ??= startsAt;
    this.nextPlaybackAt = startsAt + buffer.duration;
    this.scheduledSources.add(source);
    source.start(startsAt);
  }

  interruptPlayback(): InterruptedPlayback | null {
    const context = this.audioContext;
    const itemId = this.currentAssistantItemId;
    if (!context || !itemId || this.playbackStartedAt === null) {
      this.stopPlayback();
      return null;
    }

    const audioEndMs = Math.max(
      0,
      Math.round(
        Math.min(context.currentTime, this.nextPlaybackAt) * 1000 - this.playbackStartedAt * 1000,
      ),
    );
    this.stopPlayback();
    return { itemId, audioEndMs };
  }

  stop(): void {
    this.activeState.set(false);
    this.stopPlayback();
    if (this.processor) this.processor.onaudioprocess = null;
    this.processor?.disconnect();
    this.inputSource?.disconnect();
    this.silentGain?.disconnect();
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    if (this.audioContext) void this.audioContext.close();
    this.processor = null;
    this.inputSource = null;
    this.silentGain = null;
    this.mediaStream = null;
    this.audioContext = null;
  }

  clearError(): void {
    this.errorState.set(null);
  }

  private stopPlayback(): void {
    for (const source of this.scheduledSources) {
      try {
        source.stop();
      } catch {
        // 已結束的 AudioBufferSourceNode 不需再次停止。
      }
    }
    this.scheduledSources.clear();
    this.nextPlaybackAt = this.audioContext?.currentTime ?? 0;
    this.playbackStartedAt = null;
    this.currentAssistantItemId = null;
  }
}
