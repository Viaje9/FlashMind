import { computed, inject, Injectable, signal } from '@angular/core';
import { TTSService } from '@flashmind/api-client';
import { firstValueFrom } from 'rxjs';
import { createAudioCacheKey } from './tts.domain';

export interface TtsStoreState {
  playingText: string | null;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class TtsStore {
  private readonly ttsService = inject(TTSService);
  private readonly audioCache = new Map<string, string>();
  private currentAudio: HTMLAudioElement | null = null;

  private readonly state = signal<TtsStoreState>({
    playingText: null,
    error: null,
  });

  readonly playingText = computed(() => this.state().playingText);
  readonly error = computed(() => this.state().error);

  isPlaying(text: string): boolean {
    return this.state().playingText === text;
  }

  async play(text: string): Promise<void> {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    // 如果正在播放相同的文字，停止播放
    if (this.state().playingText === trimmedText) {
      this.stop();
      return;
    }

    // 停止目前的播放
    this.stop();

    this.state.update((s) => ({
      ...s,
      playingText: trimmedText,
      error: null,
    }));

    try {
      const audioUrl = await this.getAudioUrl(trimmedText);
      await this.playAudio(audioUrl, trimmedText);
    } catch (err) {
      this.state.update((s) => ({
        ...s,
        playingText: null,
        error: '語音播放失敗',
      }));
    }
  }

  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.state.update((s) => ({ ...s, playingText: null }));
  }

  clearError(): void {
    this.state.update((s) => ({ ...s, error: null }));
  }

  private async getAudioUrl(text: string): Promise<string> {
    const cacheKey = createAudioCacheKey(text);

    // 檢查快取
    const cached = this.audioCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 從 API 取得音訊
    const blob = await firstValueFrom(
      this.ttsService.synthesizeSpeech({ text }),
    );
    const url = URL.createObjectURL(blob);

    // 存入快取
    this.audioCache.set(cacheKey, url);

    return url;
  }

  private playAudio(url: string, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      this.currentAudio = audio;

      audio.onended = () => {
        if (this.state().playingText === text) {
          this.state.update((s) => ({ ...s, playingText: null }));
        }
        resolve();
      };

      audio.onerror = () => {
        reject(new Error('Audio playback failed'));
      };

      audio.play().catch(reject);
    });
  }
}
