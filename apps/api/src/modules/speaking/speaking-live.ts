import OpenAI from 'openai';
import { LiveWS } from 'openai/resources/live/ws';
import type { SessionStartEvent } from 'openai/resources/live/live';
import WebSocket from 'ws';

interface LiveConfig {
  voice: string;
  instructions?: string;
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
}

export function buildLiveSessionStart(config: LiveConfig): SessionStartEvent {
  // 保守限制歷史字元量，避免超過 Live 啟動歷史的 token 上限。
  let remaining = 6000;
  const history = (config.history ?? [])
    .filter((item) => item.text?.trim())
    .slice(-128);
  const input: NonNullable<SessionStartEvent['session']['input']> = [];
  for (const item of history.reverse()) {
    const text = item.text.trim().slice(-remaining);
    if (!text) break;
    input.unshift(
      item.role === 'assistant'
        ? {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text }],
          }
        : {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text }],
          },
    );
    remaining -= text.length;
    if (remaining <= 0) break;
  }
  return {
    type: 'session.start',
    session: {
      model: 'gpt-live-1',
      instructions: config.instructions,
      audio: {
        format: { type: 'audio/pcm', rate: 24000 },
        output: { voice: config.voice },
      },
      input,
      delegation: { type: 'client' },
    },
  };
}

/** 將既有瀏覽器音訊通道接到 Live；不模擬 Realtime 的回合完成事件。 */
export class SpeakingLiveConnection {
  private readonly live: LiveWS;
  private started = false;
  private closing = false;
  private closeTimer?: ReturnType<typeof setTimeout>;

  constructor(
    apiKey: string,
    config: LiveConfig,
    private readonly client: WebSocket,
    onClose: () => void,
  ) {
    this.live = new LiveWS(new OpenAI({ apiKey }));
    this.live.socket.on('open', () => {
      if (this.closing) return;
      this.live.send(buildLiveSessionStart(config));
    });
    this.live.on('event', (event) => {
      if (event.type === 'session.started') {
        this.started = true;
        this.forward({ type: 'flashmind.session.ready' });
      } else if (event.type === 'session.closed') {
        this.forward(event);
        clearTimeout(this.closeTimer);
        this.live.close();
      } else if (event.type === 'session.delegation.created') {
        // 此模式只做口說練習，沒有外部工具或背景任務可執行。
        this.live.send({
          type: 'session.instructions.append',
          delegation_id: event.delegation.id,
          content:
            'Continue the English speaking practice directly. No external tools are available; do not claim that a lookup or action was completed.',
        });
      } else {
        this.forward(event);
      }
    });
    this.live.on('error', () => {
      if (this.closing) return;
      this.forward({
        type: 'error',
        error: { message: 'OpenAI Live 連線或請求失敗' },
      });
      this.close();
    });
    this.live.socket.on('close', () => {
      clearTimeout(this.closeTimer);
      onClose();
    });
  }

  get readyState(): number {
    return this.live.socket.readyState;
  }

  send(raw: string): void {
    if (!this.started || this.closing) return;
    const event = JSON.parse(raw) as { type: string; audio?: string };
    if (event.type === 'input_audio_buffer.append' && event.audio) {
      this.live.send({
        type: 'session.input_audio.append',
        audio: event.audio,
      });
    } else if (event.type === 'session.close') {
      this.close();
    }
  }

  close(): void {
    if (this.closing) return;
    this.closing = true;
    if (!this.started || this.readyState !== WebSocket.OPEN) {
      this.live.socket.platformSocket.terminate();
      return;
    }
    this.closeTimer = setTimeout(
      () => this.live.socket.platformSocket.terminate(),
      15000,
    );
    this.closeTimer.unref();
    this.live.send({ type: 'session.close' });
  }

  private forward(event: unknown): void {
    if (this.client.readyState === WebSocket.OPEN)
      this.client.send(JSON.stringify(event));
  }
}
