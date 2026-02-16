import { Injectable, computed, signal } from '@angular/core';

export type SpeakingRecorderStatus =
  | 'idle'
  | 'recording'
  | 'paused'
  | 'stopped'
  | 'unsupported'
  | 'denied';

@Injectable({ providedIn: 'root' })
export class SpeakingRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private readonly chunks: Blob[] = [];
  private durationTimer: number | null = null;
  private startedAt = 0;

  private readonly statusState = signal<SpeakingRecorderStatus>(
    this.checkSupported() ? 'idle' : 'unsupported',
  );
  private readonly errorState = signal<string | null>(null);
  private readonly durationMsState = signal(0);
  private readonly recordedBlobState = signal<Blob | null>(null);

  readonly status = computed(() => this.statusState());
  readonly error = computed(() => this.errorState());
  readonly durationMs = computed(() => this.durationMsState());
  readonly recordedBlob = computed(() => this.recordedBlobState());
  readonly canRecord = computed(() => this.statusState() !== 'unsupported');

  async start(): Promise<void> {
    if (!this.checkSupported()) {
      this.statusState.set('unsupported');
      this.errorState.set('目前裝置不支援麥克風錄音。');
      return;
    }

    this.stopActiveTracks();
    this.clearDurationTimer();
    this.recordedBlobState.set(null);
    this.errorState.set(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = this.pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      this.mediaStream = stream;
      this.mediaRecorder = recorder;
      this.chunks.length = 0;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        this.errorState.set('錄音過程發生錯誤，請再試一次。');
      };

      recorder.start(250);
      this.startedAt = Date.now();
      this.durationMsState.set(0);
      this.startDurationTimer();
      this.statusState.set('recording');
    } catch (error) {
      const domError = error as DOMException | undefined;
      const errorName = domError?.name;

      if (errorName === 'NotAllowedError' || errorName === 'SecurityError') {
        this.statusState.set('denied');
        this.errorState.set('麥克風權限被拒絕，請到瀏覽器設定允許後再試。');
        return;
      }

      this.statusState.set('idle');

      if (errorName === 'NotFoundError') {
        this.errorState.set('找不到可用的麥克風裝置。');
        return;
      }

      if (errorName === 'NotReadableError' || errorName === 'AbortError') {
        this.errorState.set('目前無法啟用麥克風，請關閉其他使用中的錄音程式後重試。');
        return;
      }

      this.errorState.set('無法啟動錄音，請確認麥克風與瀏覽器權限後重試。');
    }
  }

  pause(): void {
    if (this.mediaRecorder?.state !== 'recording') {
      return;
    }

    this.mediaRecorder.pause();
    this.statusState.set('paused');
    this.clearDurationTimer();
  }

  resume(): void {
    if (this.mediaRecorder?.state !== 'paused') {
      return;
    }

    this.mediaRecorder.resume();
    this.statusState.set('recording');
    this.startDurationTimer();
  }

  async stop(): Promise<Blob | null> {
    if (
      !this.mediaRecorder ||
      (this.mediaRecorder.state !== 'recording' && this.mediaRecorder.state !== 'paused')
    ) {
      return this.recordedBlobState();
    }

    this.clearDurationTimer();

    await new Promise<void>((resolve) => {
      const recorder = this.mediaRecorder;
      if (!recorder) {
        resolve();
        return;
      }

      recorder.onstop = () => resolve();
      recorder.stop();
    });

    const mimeType = this.mediaRecorder?.mimeType || this.pickMimeType() || 'audio/webm';
    const blob = new Blob(this.chunks, { type: mimeType });

    this.recordedBlobState.set(blob.size > 0 ? blob : null);
    this.statusState.set('stopped');

    this.stopActiveTracks();
    this.mediaRecorder = null;

    return this.recordedBlobState();
  }

  cancel(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    this.stopActiveTracks();
    this.mediaRecorder = null;
    this.chunks.length = 0;
    this.clearDurationTimer();
    this.durationMsState.set(0);
    this.recordedBlobState.set(null);
    this.errorState.set(null);
    this.statusState.set(this.checkSupported() ? 'idle' : 'unsupported');
  }

  clearError(): void {
    this.errorState.set(null);
  }

  private startDurationTimer(): void {
    this.clearDurationTimer();

    this.durationTimer = window.setInterval(() => {
      this.durationMsState.set(Date.now() - this.startedAt);
    }, 250);
  }

  private clearDurationTimer(): void {
    if (this.durationTimer !== null) {
      window.clearInterval(this.durationTimer);
      this.durationTimer = null;
    }
  }

  private checkSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!window.MediaRecorder &&
      !!navigator.mediaDevices?.getUserMedia
    );
  }

  private pickMimeType(): string | undefined {
    if (typeof MediaRecorder === 'undefined') {
      return undefined;
    }

    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];
    return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
  }

  private stopActiveTracks(): void {
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;
  }
}
