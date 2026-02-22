import { Injectable, computed, signal } from '@angular/core';

interface PlayOptions {
  auto?: boolean;
  maxRetryAttempts?: number;
}

@Injectable({ providedIn: 'root' })
export class SpeakingAudioPlayerService {
  private currentAudio: HTMLAudioElement | null = null;
  private currentKey: string | null = null;
  private readonly objectUrlCache = new Map<string, string>();
  private readonly objectUrlOrder: string[] = [];
  private unlockInitialized = false;

  private readonly playingKeyState = signal<string | null>(null);
  private readonly pausedKeyState = signal<string | null>(null);
  private readonly errorState = signal<string | null>(null);

  readonly playingKey = computed(() => this.playingKeyState());
  readonly pausedKey = computed(() => this.pausedKeyState());
  readonly error = computed(() => this.errorState());

  constructor() {
    this.initializeAutoplayUnlock();
  }

  isPlaying(key: string): boolean {
    return this.playingKeyState() === key;
  }

  async play(blob: Blob, key: string, options: PlayOptions = {}): Promise<void> {
    this.errorState.set(null);

    if (!blob || blob.size === 0) {
      this.errorState.set('找不到可播放的語音資料。');
      return;
    }

    if (this.currentAudio && this.currentKey === key) {
      if (this.currentAudio.paused) {
        await this.resume(options);
      } else {
        this.pause();
      }
      return;
    }

    this.stop();

    const audio = this.createAudioForKey(blob, key);
    this.currentAudio = audio;
    this.currentKey = key;
    this.playingKeyState.set(key);
    this.pausedKeyState.set(null);

    const maxRetryAttempts = options.maxRetryAttempts ?? 6;

    audio.onended = () => {
      this.cleanupPlaybackStateForKey(key);
    };
    audio.onerror = () => {
      this.errorState.set('語音播放失敗，請再試一次。');
      this.cleanupPlaybackStateForKey(key);
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
    }
  }

  pause(): void {
    if (!this.currentAudio || !this.currentKey || this.currentAudio.paused) {
      return;
    }

    this.currentAudio.pause();
    this.playingKeyState.set(null);
    this.pausedKeyState.set(this.currentKey);
  }

  async resume(options: PlayOptions = {}): Promise<void> {
    if (!this.currentAudio || !this.currentKey || !this.currentAudio.paused) {
      return;
    }

    this.errorState.set(null);
    const maxRetryAttempts = options.maxRetryAttempts ?? 6;
    const key = this.currentKey;

    try {
      if (options.auto) {
        await this.playWithFallback(this.currentAudio, maxRetryAttempts);
      } else {
        await this.currentAudio.play();
      }

      this.playingKeyState.set(key);
      this.pausedKeyState.set(null);
    } catch {
      this.errorState.set('語音播放失敗，請再試一次。');
      this.cleanupPlaybackStateForKey(key);
    }
  }

  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
    }

    this.clearPlaybackState();
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
  }

  private createAudioForKey(blob: Blob, key: string): HTMLAudioElement {
    const cachedUrl = this.objectUrlCache.get(key);
    const objectUrl = cachedUrl ?? URL.createObjectURL(blob);

    if (!cachedUrl) {
      this.objectUrlCache.set(key, objectUrl);
      this.objectUrlOrder.push(key);
      this.evictUrlCacheIfNeeded();
    }

    return new Audio(objectUrl);
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

    if (this.currentAudio) {
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
    }

    this.clearPlaybackState();
  }

  private clearPlaybackState(): void {
    this.currentAudio = null;
    this.currentKey = null;
    this.playingKeyState.set(null);
    this.pausedKeyState.set(null);
  }
}
