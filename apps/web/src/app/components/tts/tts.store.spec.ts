import '@angular/compiler';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TTSService } from '@flashmind/api-client';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeakingAudioPlayerService } from '../speaking/speaking-audio-player.service';
import { createAudioCacheKey } from './tts.domain';
import { TtsStore } from './tts.store';

class MockAudioPlayer {
  private readonly playingKeyState = signal<string | null>(null);
  private readonly pausedKeyState = signal<string | null>(null);
  readonly playingKey = computed(() => this.playingKeyState());
  readonly pausedKey = computed(() => this.pausedKeyState());
  readonly play = vi.fn(async (_blob: Blob, key: string) => {
    this.playingKeyState.set(key);
    this.pausedKeyState.set(null);
  });
  readonly pause = vi.fn(() => {
    this.pausedKeyState.set(this.playingKeyState());
    this.playingKeyState.set(null);
  });
  readonly resume = vi.fn(async () => {
    this.playingKeyState.set(this.pausedKeyState());
    this.pausedKeyState.set(null);
  });
  readonly stop = vi.fn(() => {
    this.playingKeyState.set(null);
    this.pausedKeyState.set(null);
  });
  readonly clearError = vi.fn();

  finish(key: string): void {
    if (this.playingKeyState() === key) {
      this.playingKeyState.set(null);
      this.pausedKeyState.set(null);
    }
  }
}

describe('TtsStore', () => {
  let store: TtsStore;
  let audioPlayer: MockAudioPlayer;

  beforeEach(() => {
    audioPlayer = new MockAudioPlayer();

    TestBed.configureTestingModule({
      providers: [
        TtsStore,
        {
          provide: TTSService,
          useValue: {
            synthesizeSpeech: vi.fn().mockReturnValue(of(new Blob(['audio']))),
            synthesizeWord: vi.fn().mockReturnValue(of(new Blob(['word-audio']))),
          },
        },
        {
          provide: SpeakingAudioPlayerService,
          useValue: audioPlayer,
        },
      ],
    });

    store = TestBed.inject(TtsStore);
  });

  it('句子播放完畢後應清除播放文字', async () => {
    await store.play('No sauce, please.');
    TestBed.flushEffects();

    expect(store.isPlaying('No sauce, please.')).toBe(true);

    audioPlayer.finish(createAudioCacheKey('No sauce, please.'));
    TestBed.flushEffects();

    expect(store.isPlaying('No sauce, please.')).toBe(false);
    expect(store.playingText()).toBeNull();
  });
});
