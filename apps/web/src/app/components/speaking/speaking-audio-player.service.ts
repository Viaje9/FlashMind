import { Injectable, computed, signal } from '@angular/core';

interface PlayOptions {
  auto?: boolean;
  maxRetryAttempts?: number;
}

function createSilentWavBlob(durationMs = 250): Blob {
  const sampleRate = 8000;
  const channels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const sampleCount = Math.max(1, Math.floor((sampleRate * durationMs) / 1000));
  const dataSize = sampleCount * channels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, value: string): void => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);

  return new Blob([buffer], { type: 'audio/wav' });
}

@Injectable({ providedIn: 'root' })
export class SpeakingAudioPlayerService {
  private trackAudio: HTMLAudioElement | null = null;
  private currentKey: string | null = null;
  private readonly objectUrlCache = new Map<string, string>();
  private readonly objectUrlOrder: string[] = [];
  private unlockInitialized = false;
  private keepAliveUrl: string | null = null;
  private keepAliveActive = false;
  private sharedTrackEnabled = false;

  private readonly playingKeyState = signal<string | null>(null);
  private readonly pausedKeyState = signal<string | null>(null);
  private readonly errorState = signal<string | null>(null);
  private readonly mutedState = signal(false);

  readonly playingKey = computed(() => this.playingKeyState());
  readonly pausedKey = computed(() => this.pausedKeyState());
  readonly error = computed(() => this.errorState());
  readonly muted = computed(() => this.mutedState());

  constructor() {
    this.initializeAutoplayUnlock();
  }

  isPlaying(key: string): boolean {
    return this.playingKeyState() === key;
  }

  async activateSharedTrack(): Promise<void> {
    this.errorState.set(null);
    this.sharedTrackEnabled = true;
    await this.enterKeepAliveMode();
  }

  deactivateSharedTrack(): void {
    this.sharedTrackEnabled = false;

    if (!this.trackAudio) {
      return;
    }

    this.trackAudio.onended = null;
    this.trackAudio.onerror = null;
    this.trackAudio.pause();
    this.trackAudio.currentTime = 0;
    this.trackAudio.removeAttribute('src');
    this.trackAudio.load();

    this.keepAliveActive = false;
    this.clearPlaybackState();
  }

  setMuted(muted: boolean): void {
    this.mutedState.set(muted);
    if (this.trackAudio) {
      this.trackAudio.muted = muted;
    }
  }

  async play(blob: Blob, key: string, options: PlayOptions = {}): Promise<void> {
    this.errorState.set(null);

    if (!blob || blob.size === 0) {
      this.errorState.set('找不到可播放的語音資料。');
      return;
    }

    const audio = this.ensureTrackAudio();

    if (this.currentKey === key) {
      if (audio.paused) {
        await this.resume(options);
      } else {
        this.pause();
      }
      return;
    }

    this.stopCurrentClip();

    const sourceUrl = this.getSourceUrlForKey(blob, key);
    this.applySource(audio, sourceUrl, false);

    this.currentKey = key;
    this.keepAliveActive = false;
    this.playingKeyState.set(key);
    this.pausedKeyState.set(null);

    const maxRetryAttempts = options.maxRetryAttempts ?? 6;

    audio.onended = () => {
      this.cleanupPlaybackStateForKey(key);
      if (this.sharedTrackEnabled) {
        void this.enterKeepAliveMode();
      }
    };
    audio.onerror = () => {
      this.errorState.set('語音播放失敗，請再試一次。');
      this.cleanupPlaybackStateForKey(key);
      if (this.sharedTrackEnabled) {
        void this.enterKeepAliveMode();
      }
    };

    try {
      if (options.auto) {
        await this.playWithFallback(audio, maxRetryAttempts);
      } else {
        await audio.play();
      }
    } catch {
      this.errorState.set('語音播放失敗，請再試一次。');
      this.cleanupPlaybackStateForKey(key);
      if (this.sharedTrackEnabled) {
        void this.enterKeepAliveMode();
      }
    }
  }

  pause(): void {
    if (!this.trackAudio || !this.currentKey || this.trackAudio.paused) {
      return;
    }

    this.trackAudio.pause();
    this.playingKeyState.set(null);
    this.pausedKeyState.set(this.currentKey);
  }

  async resume(options: PlayOptions = {}): Promise<void> {
    if (!this.trackAudio || !this.currentKey || !this.trackAudio.paused) {
      return;
    }

    this.errorState.set(null);
    const maxRetryAttempts = options.maxRetryAttempts ?? 6;
    const key = this.currentKey;

    try {
      if (options.auto) {
        await this.playWithFallback(this.trackAudio, maxRetryAttempts);
      } else {
        await this.trackAudio.play();
      }

      this.playingKeyState.set(key);
      this.pausedKeyState.set(null);
    } catch {
      this.errorState.set('語音播放失敗，請再試一次。');
      this.cleanupPlaybackStateForKey(key);
      if (this.sharedTrackEnabled) {
        void this.enterKeepAliveMode();
      }
    }
  }

  stop(): void {
    this.stopCurrentClip();
    if (this.sharedTrackEnabled) {
      void this.enterKeepAliveMode();
    }
  }

  clearError(): void {
    this.errorState.set(null);
  }

  clearCache(): void {
    for (const url of this.objectUrlCache.values()) {
      URL.revokeObjectURL(url);
    }
    this.objectUrlCache.clear();
    this.objectUrlOrder.length = 0;

    if (this.keepAliveUrl) {
      URL.revokeObjectURL(this.keepAliveUrl);
      this.keepAliveUrl = null;
    }
  }

  private ensureTrackAudio(): HTMLAudioElement {
    if (this.trackAudio) {
      return this.trackAudio;
    }

    const audio = new Audio();
    audio.preload = 'auto';
    audio.muted = this.mutedState();
    this.trackAudio = audio;
    return audio;
  }

  private async enterKeepAliveMode(): Promise<void> {
    if (!this.sharedTrackEnabled) {
      return;
    }

    const audio = this.ensureTrackAudio();
    const keepAliveUrl = this.getKeepAliveUrl();

    if (this.currentKey) {
      return;
    }

    if (!this.keepAliveActive) {
      this.applySource(audio, keepAliveUrl, true);
      this.keepAliveActive = true;
    }

    if (!audio.paused) {
      return;
    }

    try {
      await audio.play();
    } catch {
      // ignore keep-alive failure; next user interaction/playback can recover
    }
  }

  private getKeepAliveUrl(): string {
    if (this.keepAliveUrl) {
      return this.keepAliveUrl;
    }

    this.keepAliveUrl = URL.createObjectURL(createSilentWavBlob());
    return this.keepAliveUrl;
  }

  private getSourceUrlForKey(blob: Blob, key: string): string {
    const cachedUrl = this.objectUrlCache.get(key);
    if (cachedUrl) {
      return cachedUrl;
    }

    const objectUrl = URL.createObjectURL(blob);
    this.objectUrlCache.set(key, objectUrl);
    this.objectUrlOrder.push(key);
    this.evictUrlCacheIfNeeded();

    return objectUrl;
  }

  private applySource(audio: HTMLAudioElement, sourceUrl: string, loop: boolean): void {
    if (audio.src === sourceUrl && audio.loop === loop) {
      return;
    }

    audio.pause();
    audio.currentTime = 0;
    audio.src = sourceUrl;
    audio.loop = loop;
  }

  private stopCurrentClip(): void {
    if (!this.trackAudio) {
      this.clearPlaybackState();
      return;
    }

    this.trackAudio.onended = null;
    this.trackAudio.onerror = null;
    this.trackAudio.pause();
    this.trackAudio.currentTime = 0;

    this.clearPlaybackState();
  }

  private async playWithFallback(audio: HTMLAudioElement, maxRetryAttempts: number): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetryAttempts; attempt += 1) {
      try {
        await this.tryPlayWhenVisible(audio, attempt);
        return;
      } catch (error) {
        lastError = error;
        await this.wait(this.retryDelay(attempt));
      }
    }

    throw lastError ?? new Error('autoplay failed');
  }

  private async tryPlayWhenVisible(audio: HTMLAudioElement, attempt: number): Promise<void> {
    if (this.isDocumentHidden()) {
      await this.waitForDocumentVisible();
    }

    if (attempt > 1) {
      await this.resumeAudioContextIfAny();
    }

    await audio.play();
  }

  private retryDelay(attempt: number): number {
    const delay = 120 * 2 ** (attempt - 1);
    return Math.min(delay, 1200);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  private isDocumentHidden(): boolean {
    return typeof document !== 'undefined' && document.visibilityState === 'hidden';
  }

  private waitForDocumentVisible(): Promise<void> {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const onVisible = () => {
        if (document.visibilityState !== 'visible') {
          return;
        }
        document.removeEventListener('visibilitychange', onVisible);
        resolve();
      };

      document.addEventListener('visibilitychange', onVisible);
    });
  }

  private async resumeAudioContextIfAny(): Promise<void> {
    const audioContext = this.getAudioContext();
    if (audioContext && audioContext.state !== 'running') {
      try {
        await audioContext.resume();
      } catch {
        // ignore resume failures, next play attempt still has chance to pass
      }
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const Ctx =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) {
      return null;
    }

    try {
      return new Ctx();
    } catch {
      return null;
    }
  }

  private initializeAutoplayUnlock(): void {
    if (this.unlockInitialized || typeof window === 'undefined') {
      return;
    }

    this.unlockInitialized = true;

    const unlock = () => {
      void this.resumeAudioContextIfAny();
      if (this.sharedTrackEnabled) {
        void this.enterKeepAliveMode();
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
  }

  private evictUrlCacheIfNeeded(): void {
    const MAX_CACHE = 120;

    while (this.objectUrlOrder.length > MAX_CACHE) {
      const oldestKey = this.objectUrlOrder.shift();
      if (!oldestKey) {
        continue;
      }

      if (oldestKey === this.currentKey) {
        this.objectUrlOrder.push(oldestKey);
        break;
      }

      const url = this.objectUrlCache.get(oldestKey);
      if (url) {
        URL.revokeObjectURL(url);
        this.objectUrlCache.delete(oldestKey);
      }
    }
  }

  private cleanupPlaybackStateForKey(key: string): void {
    if (this.currentKey !== key) {
      return;
    }

    if (this.trackAudio) {
      this.trackAudio.onended = null;
      this.trackAudio.onerror = null;
    }

    this.clearPlaybackState();
  }

  private clearPlaybackState(): void {
    this.currentKey = null;
    this.playingKeyState.set(null);
    this.pausedKeyState.set(null);
  }
}
