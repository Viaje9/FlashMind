import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { Configuration } from '@flashmind/api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeakingRealtimeService } from './speaking-realtime.service';

describe('SpeakingRealtimeService live transcription', () => {
  let service: SpeakingRealtimeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SpeakingRealtimeService,
        { provide: Configuration, useValue: new Configuration({ basePath: '/api' }) },
      ],
    });
    service = TestBed.inject(SpeakingRealtimeService);
  });

  it('應把輸入語音的增量與完成逐字稿通知畫面', () => {
    const onUserTranscriptDelta = vi.fn();
    const onUserTranscriptCompleted = vi.fn();
    service.startLive({
      onSpeechStarted: vi.fn(),
      onUserTranscriptDelta,
      onUserTranscriptCompleted,
      onAssistantItem: vi.fn(),
      onAudioDelta: vi.fn(),
      onTurnCompleted: vi.fn(),
      onError: vi.fn(),
    });

    const handleLiveEvent = (
      service as unknown as {
        handleLiveEvent: (type: string, event: Record<string, unknown>) => void;
      }
    ).handleLiveEvent.bind(service);

    handleLiveEvent('input_audio_buffer.speech_started', { audio_start_ms: 0 });
    handleLiveEvent('conversation.item.input_audio_transcription.delta', {
      delta: 'Hello',
    });
    handleLiveEvent('conversation.item.input_audio_transcription.delta', {
      delta: ' world',
    });
    handleLiveEvent('conversation.item.input_audio_transcription.completed', {
      transcript: 'Hello world.',
    });

    expect(onUserTranscriptDelta).toHaveBeenNthCalledWith(1, 'Hello');
    expect(onUserTranscriptDelta).toHaveBeenNthCalledWith(2, ' world');
    expect(onUserTranscriptCompleted).toHaveBeenCalledWith('Hello world.');
  });
});
