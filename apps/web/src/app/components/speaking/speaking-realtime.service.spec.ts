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

describe('GPT Live 事件', () => {
  it('持續播放與轉錄不依賴 Realtime 回合，停止時仍接收最後文字', () => {
    TestBed.configureTestingModule({
      providers: [
        SpeakingRealtimeService,
        { provide: Configuration, useValue: new Configuration({ basePath: '/api' }) },
      ],
    });
    const service = TestBed.inject(SpeakingRealtimeService);
    const internals = service as unknown as {
      gptLive: boolean;
      socket: {
        readyState: number;
        send: ReturnType<typeof vi.fn>;
        close: ReturnType<typeof vi.fn>;
      };
      handleEvent: (event: Record<string, unknown>) => void;
    };
    internals.gptLive = true;
    const socket = { readyState: 1, send: vi.fn(), close: vi.fn() };
    internals.socket = socket;
    const handlers = {
      onSpeechStarted: vi.fn(),
      onUserTranscriptDelta: vi.fn(),
      onUserTranscriptCompleted: vi.fn(),
      onAssistantItem: vi.fn(),
      onAudioDelta: vi.fn(),
      onTurnCompleted: vi.fn(),
      onError: vi.fn(),
      onTranscriptFragment: vi.fn(),
    };
    service.startLive(handlers);
    internals.handleEvent({ type: 'session.output_audio.delta', delta: 'AAAA' });
    expect(handlers.onAudioDelta).toHaveBeenCalledWith('AAAA');
    service.stopLive();
    service.disconnect();
    expect(socket.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(socket.send.mock.calls[0][0])).toEqual({ type: 'session.close' });
    expect(socket.close).not.toHaveBeenCalled();
    internals.handleEvent({
      type: 'session.output_transcript.delta',
      event_id: 'last',
      delta: 'Goodbye',
      start_ms: 100,
      end_ms: 300,
    });
    expect(handlers.onTranscriptFragment).toHaveBeenCalledWith({
      eventId: 'last',
      role: 'assistant',
      delta: 'Goodbye',
      startMs: 100,
      endMs: 300,
    });
    internals.handleEvent({ type: 'session.closed' });
    expect(socket.close).toHaveBeenCalledTimes(1);
    expect(handlers.onTurnCompleted).not.toHaveBeenCalled();
  });
});
