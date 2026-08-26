import { Injectable, inject } from '@angular/core';
import { Configuration, type SpeakingTokenUsage } from '@flashmind/api-client';
import {
  pcm16Base64FromWav,
  wavBlobFromPcm16Base64,
  wavPcm16DurationSeconds,
} from './speaking-realtime-audio';
import {
  SPEAKING_DEFAULT_SYSTEM_PROMPT,
  type SpeakingMessage,
  type SpeakingSettings,
} from './speaking.domain';

export interface SpeakingRealtimeTurnResult {
  userTranscript: string;
  assistantTranscript: string;
  assistantAudio: Blob;
  usage: SpeakingTokenUsage;
  transcriptionDurationSeconds: number;
  memoryUpdate?: { memory: string; reason?: string };
}

interface PendingTurn {
  resolve: (value: SpeakingRealtimeTurnResult) => void;
  reject: (reason: Error) => void;
  userTranscript: string;
  assistantTranscript: string;
  audioChunks: string[];
  usage?: SpeakingTokenUsage;
  responseDone: boolean;
  completionTimer?: number;
  transcriptionDurationSeconds: number;
  memoryUpdate?: { memory: string; reason?: string };
}

@Injectable({ providedIn: 'root' })
export class SpeakingRealtimeService {
  private readonly apiConfiguration = inject(Configuration);
  private socket: WebSocket | null = null;
  private readyPromise: Promise<void> | null = null;
  private pendingTurn: PendingTurn | null = null;
  private conversationId: string | null = null;

  async connect(input: {
    conversationId: string;
    settings: SpeakingSettings;
    history: SpeakingMessage[];
  }): Promise<void> {
    if (
      this.socket?.readyState === WebSocket.OPEN &&
      this.conversationId === input.conversationId
    ) {
      return;
    }

    this.disconnect();
    this.conversationId = input.conversationId;
    const socket = new WebSocket(this.buildUrl());
    this.socket = socket;

    this.readyPromise = new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('Realtime 連線逾時')), 10_000);
      let ready = false;

      socket.onopen = () => {
        socket.send(
          JSON.stringify({
            type: 'session.configure',
            voice: input.settings.voice,
            instructions: input.settings.systemPrompt.trim() || SPEAKING_DEFAULT_SYSTEM_PROMPT,
            memory: input.settings.memory || undefined,
            autoMemoryEnabled: input.settings.autoMemoryEnabled,
            nextPractice: input.settings.nextPractice,
            history: input.history
              .filter((message) => message.role !== 'summary' && message.text?.trim())
              .map((message) => ({ role: message.role, text: message.text!.trim() })),
          }),
        );
      };

      socket.onmessage = (message) => {
        const event = JSON.parse(String(message.data)) as Record<string, unknown>;
        if (event['type'] === 'flashmind.session.ready') {
          ready = true;
          window.clearTimeout(timeout);
          resolve();
          return;
        }
        if (event['type'] === 'error' && !ready) {
          const error = event['error'] as { message?: string } | undefined;
          window.clearTimeout(timeout);
          reject(new Error(error?.message || 'Realtime session 設定失敗'));
          socket.close();
          return;
        }
        this.handleEvent(event);
      };

      socket.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error('Realtime WebSocket 連線失敗'));
        this.rejectPending('Realtime WebSocket 連線失敗');
      };
      socket.onclose = () => {
        window.clearTimeout(timeout);
        this.rejectPending('Realtime WebSocket 已中斷');
        if (this.socket === socket) this.socket = null;
      };
    });

    await this.readyPromise;
  }

  async sendTurn(wavBlob: Blob): Promise<SpeakingRealtimeTurnResult> {
    await this.readyPromise;
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || this.pendingTurn) {
      throw new Error('Realtime 尚未就緒');
    }

    const audio = await pcm16Base64FromWav(wavBlob);
    const transcriptionDurationSeconds = await wavPcm16DurationSeconds(wavBlob);
    const result = new Promise<SpeakingRealtimeTurnResult>((resolve, reject) => {
      this.pendingTurn = {
        resolve,
        reject,
        userTranscript: '',
        assistantTranscript: '',
        audioChunks: [],
        responseDone: false,
        transcriptionDurationSeconds,
      };
    });

    this.socket.send(JSON.stringify({ type: 'input_audio_buffer.append', audio }));
    this.socket.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    return result;
  }

  cancelResponse(): void {
    if (this.socket?.readyState === WebSocket.OPEN && this.pendingTurn) {
      this.socket.send(JSON.stringify({ type: 'response.cancel' }));
    }
  }

  disconnect(): void {
    this.rejectPending('Realtime session 已結束');
    this.socket?.close();
    this.socket = null;
    this.readyPromise = null;
    this.conversationId = null;
  }

  private handleEvent(event: Record<string, unknown>): void {
    const type = String(event['type'] ?? '');
    if (type === 'error') {
      const error = event['error'] as { message?: string } | undefined;
      this.rejectPending(error?.message || 'Realtime 回覆失敗');
      return;
    }

    const pending = this.pendingTurn;
    if (!pending) return;

    if (type === 'conversation.item.input_audio_transcription.completed') {
      pending.userTranscript = String(event['transcript'] ?? '').trim();
    } else if (type === 'response.output_audio.delta') {
      const delta = String(event['delta'] ?? '');
      if (delta) pending.audioChunks.push(delta);
    } else if (type === 'response.output_audio_transcript.delta') {
      pending.assistantTranscript += String(event['delta'] ?? '');
    } else if (
      type === 'response.output_audio_transcript.done' ||
      type === 'response.output_audio_transcript.completed'
    ) {
      pending.assistantTranscript =
        String(event['transcript'] ?? '').trim() || pending.assistantTranscript.trim();
    } else if (type === 'flashmind.memory.updated') {
      const memory = String(event['memory'] ?? '').trim();
      if (memory) {
        pending.memoryUpdate = {
          memory,
          reason: String(event['reason'] ?? '').trim() || undefined,
        };
      }
    } else if (type === 'response.done') {
      pending.responseDone = true;
      const response = event['response'] as Record<string, unknown> | undefined;
      pending.usage = this.mapUsage(response?.['usage']);
      pending.assistantTranscript ||= this.readTranscriptFromResponse(response);
    }

    this.completeWhenReady();
  }

  private completeWhenReady(): void {
    const pending = this.pendingTurn;
    if (
      !pending?.responseDone ||
      !pending.assistantTranscript ||
      pending.audioChunks.length === 0
    ) {
      return;
    }

    if (pending.userTranscript) {
      this.resolvePending(pending);
      return;
    }

    if (!pending.completionTimer) {
      pending.completionTimer = window.setTimeout(() => this.resolvePending(pending), 1200);
    }
  }

  private resolvePending(pending: PendingTurn): void {
    if (this.pendingTurn !== pending) return;
    if (pending.completionTimer) window.clearTimeout(pending.completionTimer);
    this.pendingTurn = null;
    pending.resolve({
      userTranscript: pending.userTranscript.trim(),
      assistantTranscript: pending.assistantTranscript.trim(),
      assistantAudio: wavBlobFromPcm16Base64(pending.audioChunks, 24000),
      usage: pending.usage ?? this.emptyUsage(),
      transcriptionDurationSeconds: pending.transcriptionDurationSeconds,
      memoryUpdate: pending.memoryUpdate,
    });
  }

  private rejectPending(message: string): void {
    const pending = this.pendingTurn;
    if (!pending) return;
    if (pending.completionTimer) window.clearTimeout(pending.completionTimer);
    this.pendingTurn = null;
    pending.reject(new Error(message));
  }

  private buildUrl(): string {
    const basePath = this.apiConfiguration.basePath ?? '/api';
    const url = new URL(basePath, window.location.origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = `${url.pathname.replace(/\/$/, '')}/speaking/realtime`;
    return url.toString();
  }

  private readTranscriptFromResponse(response?: Record<string, unknown>): string {
    const output = response?.['output'];
    if (!Array.isArray(output)) return '';
    for (const item of output) {
      const content = (item as { content?: unknown[] }).content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        const transcript = (part as { transcript?: string }).transcript?.trim();
        if (transcript) return transcript;
      }
    }
    return '';
  }

  private mapUsage(raw: unknown): SpeakingTokenUsage {
    const usage = (raw ?? {}) as Record<string, unknown>;
    const input = (usage['input_token_details'] ?? {}) as Record<string, number>;
    const output = (usage['output_token_details'] ?? {}) as Record<string, number>;
    return {
      promptTokens: Number(usage['input_tokens'] ?? 0),
      completionTokens: Number(usage['output_tokens'] ?? 0),
      totalTokens: Number(usage['total_tokens'] ?? 0),
      promptTextTokens: Number(input['text_tokens'] ?? 0),
      promptAudioTokens: Number(input['audio_tokens'] ?? 0),
      completionTextTokens: Number(output['text_tokens'] ?? 0),
      completionAudioTokens: Number(output['audio_tokens'] ?? 0),
    } as SpeakingTokenUsage;
  }

  private emptyUsage(): SpeakingTokenUsage {
    return this.mapUsage(undefined);
  }
}
