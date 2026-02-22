import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { TTSService } from '@flashmind/api-client';
import { firstValueFrom } from 'rxjs';
import { SpeakingAudioPlayerService } from '../speaking/speaking-audio-player.service';
import { createAudioCacheKey, createWordAudioCacheKey } from './tts.domain';

export interface TtsStoreState {
  playingText: string | null;
  loadingText: string | null;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class TtsStore {
  private readonly ttsService = inject(TTSService);
  private readonly audioPlayer = inject(SpeakingAudioPlayerService);
  private readonly audioCache = new Map<string, Blob>();
  private currentPlaybackKey: string | null = null;

  private readonly state = signal<TtsStoreState>({
    playingText: null,
    loadingText: null,
    error: null,
  });

  readonly playingText = computed(() => this.state().playingText);
  readonly loadingText = computed(() => this.state().loadingText);
  readonly error = computed(() => this.state().error);

  constructor() {
    effect(() => {
      const activeKey = this.currentPlaybackKey;
      if (!activeKey) {
        return;
      }

      const playingKey = this.audioPlayer.playingKey();
      const pausedKey = this.audioPlayer.pausedKey();
      if (playingKey === activeKey || pausedKey === activeKey) {
        return;
      }

      this.currentPlaybackKey = null;
      if (this.state().playingText) {
        this.state.update((s) => ({ ...s, playingText: null }));
      }
    });
  }

  isPlaying(text: string): boolean {
    return this.state().playingText === text;
  }

  isLoading(text: string): boolean {
    return this.state().loadingText === text;
  }

  async play(text: string): Promise<void> {
    const trimmedText = text.trim();
    if (!trimmedText) return;
    const cacheKey = createAudioCacheKey(trimmedText);
    this.audioPlayer.clearError();

    if (this.currentPlaybackKey === cacheKey && this.audioPlayer.playingKey() === cacheKey) {
      this.audioPlayer.pause();
      this.state.update((s) => ({ ...s, playingText: null, loadingText: null }));
      return;
    }

    if (this.currentPlaybackKey === cacheKey && this.audioPlayer.pausedKey() === cacheKey) {
      this.errorStateClear();
      await this.audioPlayer.resume();
      this.state.update((s) => ({ ...s, playingText: trimmedText, loadingText: null }));
      return;
    }

    this.stop();

    this.state.update((s) => ({
      ...s,
      loadingText: trimmedText,
      error: null,
    }));

    try {
      const audioBlob = await this.getSentenceAudioBlob(trimmedText);
      this.state.update((s) => ({
        ...s,
        loadingText: null,
      }));
      await this.audioPlayer.play(audioBlob, cacheKey, { auto: false });
      this.currentPlaybackKey = cacheKey;
      this.state.update((s) => ({
        ...s,
        playingText: trimmedText,
      }));
    } catch {
      this.state.update((s) => ({
        ...s,
        loadingText: null,
        playingText: null,
        error: '語音播放失敗',
      }));
      this.audioPlayer.clearError();
    }
  }

  async playWord(text: string): Promise<void> {
    const trimmedText = text.trim();
    if (!trimmedText) return;
    const cacheKey = createWordAudioCacheKey(trimmedText);
    this.audioPlayer.clearError();

    if (this.currentPlaybackKey === cacheKey && this.audioPlayer.playingKey() === cacheKey) {
      this.audioPlayer.pause();
      this.state.update((s) => ({ ...s, playingText: null, loadingText: null }));
      return;
    }

    if (this.currentPlaybackKey === cacheKey && this.audioPlayer.pausedKey() === cacheKey) {
      this.errorStateClear();
      await this.audioPlayer.resume();
      this.state.update((s) => ({ ...s, playingText: trimmedText, loadingText: null }));
      return;
    }

    this.stop();

    this.state.update((s) => ({
      ...s,
      loadingText: trimmedText,
      error: null,
    }));

    try {
      const audioBlob = await this.getWordAudioBlob(trimmedText);
      this.state.update((s) => ({
        ...s,
        loadingText: null,
      }));
      await this.audioPlayer.play(audioBlob, cacheKey, { auto: false });
      this.currentPlaybackKey = cacheKey;
      this.state.update((s) => ({
        ...s,
        playingText: trimmedText,
      }));
    } catch {
      this.state.update((s) => ({
        ...s,
        loadingText: null,
        playingText: null,
        error: '語音播放失敗',
      }));
      this.audioPlayer.clearError();
    }
  }

  stop(): void {
    if (this.currentPlaybackKey) {
      const playingKey = this.audioPlayer.playingKey();
      const pausedKey = this.audioPlayer.pausedKey();
      if (playingKey === this.currentPlaybackKey || pausedKey === this.currentPlaybackKey) {
        this.audioPlayer.stop();
      }
    }
    this.currentPlaybackKey = null;
    this.state.update((s) => ({ ...s, playingText: null, loadingText: null }));
  }

  clearError(): void {
    this.errorStateClear();
    this.audioPlayer.clearError();
  }

  private async getSentenceAudioBlob(text: string): Promise<Blob> {
    const cacheKey = createAudioCacheKey(text);

    const cached = this.audioCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const blob = await firstValueFrom(this.ttsService.synthesizeSpeech({ text }));
    this.audioCache.set(cacheKey, blob);

    return blob;
  }

  private async getWordAudioBlob(text: string): Promise<Blob> {
    const cacheKey = createWordAudioCacheKey(text);

    const cached = this.audioCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const blob = await firstValueFrom(this.ttsService.synthesizeWord({ text }));
    this.audioCache.set(cacheKey, blob);

    return blob;
  }

  private errorStateClear(): void {
    this.state.update((s) => ({ ...s, error: null }));
  }
}
