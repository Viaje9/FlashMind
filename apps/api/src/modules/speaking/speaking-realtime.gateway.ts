import { HttpAdapterHost } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import type { Server as HttpServer, IncomingMessage } from 'node:http';
import WebSocket, { type RawData, WebSocketServer } from 'ws';
import { SessionService } from '../auth/session.service';

interface ConfigureEvent {
  type: 'session.configure';
  voice: string;
  interactionMode?: 'TURN_BASED' | 'REALTIME' | 'FULL_DUPLEX';
  instructions?: string;
  memory?: string;
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
  autoMemoryEnabled?: boolean;
  lastPractice?: {
    title: string;
    summary: string;
  };
  nextPractice?: {
    topic: string;
    speakingGoal: string;
    guidingQuestions: string[];
    recallTargets: string[];
  };
}

type ClientEvent =
  | ConfigureEvent
  | { type: 'input_audio_buffer.append'; audio: string }
  | { type: 'input_audio_buffer.commit' }
  | { type: 'response.cancel' }
  | {
      type: 'conversation.item.truncate';
      item_id: string;
      content_index: number;
      audio_end_ms: number;
    };

@Injectable()
export class SpeakingRealtimeGateway
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly path = '/api/speaking/realtime';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly transcriptionModel: string;
  private server?: WebSocketServer;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly sessionService: SessionService,
  ) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY') ?? '';
    this.model =
      this.configService.get<string>('OPENAI_SPEAKING_AUDIO_MODEL') ??
      'gpt-realtime-2.1-mini';
    this.transcriptionModel =
      this.configService.get<string>('OPENAI_SPEAKING_TRANSCRIPTION_MODEL') ??
      'gpt-transcribe';
  }

  onApplicationBootstrap(): void {
    const httpServer = this.httpAdapterHost.httpAdapter?.getHttpServer() as
      | HttpServer
      | undefined;
    if (!httpServer) return;

    this.server = new WebSocketServer({
      noServer: true,
      maxPayload: 32 * 1024 * 1024,
    });
    httpServer.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (url.pathname !== this.path) return;

      if (!this.isAllowedOrigin(request.headers.origin)) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      void this.authenticate(request)
        .then((authenticated) => {
          if (!authenticated || !this.server) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }

          this.server.handleUpgrade(request, socket, head, (client) => {
            this.handleClient(client);
          });
        })
        .catch(() => {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
        });
    });
  }

  onApplicationShutdown(): void {
    this.server?.clients.forEach((client) => client.close());
    this.server?.close();
  }

  buildSessionUpdate(
    config: Omit<ConfigureEvent, 'type'>,
  ): Record<string, unknown> {
    const memory = config.memory?.trim();
    const lastPractice = this.buildLastPracticeContext(config.lastPractice);
    const nextPractice = this.buildNextPracticeContext(config.nextPractice);
    const instructions = [
      config.instructions?.trim(),
      memory ? `Long-term memory:\n${memory}` : '',
      lastPractice,
      nextPractice,
    ]
      .filter(Boolean)
      .join('\n\n');

    return {
      type: 'session.update',
      session: {
        type: 'realtime',
        model: this.model,
        output_modalities: ['audio'],
        instructions: instructions || undefined,
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: 24000 },
            transcription: { model: this.transcriptionModel },
            turn_detection:
              config.interactionMode === 'FULL_DUPLEX'
                ? {
                    type: 'server_vad',
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 700,
                    create_response: true,
                    interrupt_response: true,
                  }
                : null,
          },
          output: {
            format: { type: 'audio/pcm', rate: 24000 },
            voice: config.voice,
          },
        },
        tools: config.autoMemoryEnabled
          ? [
              {
                type: 'function',
                name: 'update_memory',
                description:
                  'Update long-term memory only when stable user preferences, goals, or level information should be remembered.',
                parameters: {
                  type: 'object',
                  properties: {
                    memory: {
                      type: 'string',
                      description:
                        'Full replacement memory text. Keep concise, factual, and under 1200 characters.',
                    },
                    reason: {
                      type: 'string',
                      description: 'Why this memory should be updated.',
                    },
                  },
                  required: ['memory'],
                  additionalProperties: false,
                },
              },
            ]
          : undefined,
      },
    };
  }

  private buildLastPracticeContext(
    lastPractice: ConfigureEvent['lastPractice'],
  ): string {
    if (!lastPractice) return '';

    const title = lastPractice.title?.trim();
    const summary = lastPractice.summary?.trim();
    if (!title && !summary) return '';

    return [
      'Previous conversation context (private background):',
      title ? `Topic: ${title}` : '',
      summary ? `Summary: ${summary}` : '',
      'If the user asks what you discussed last time, answer directly from this context. Otherwise, use it only when it helps the conversation continue naturally.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildNextPracticeContext(
    nextPractice: ConfigureEvent['nextPractice'],
  ): string {
    if (!nextPractice) return '';

    const topic = nextPractice.topic?.trim();
    const speakingGoal = nextPractice.speakingGoal?.trim();
    const guidingQuestions = (nextPractice.guidingQuestions ?? [])
      .map((question) => question.trim())
      .filter(Boolean)
      .slice(0, 3);
    const recallTargets = (nextPractice.recallTargets ?? [])
      .map((term) => term.trim())
      .filter(Boolean)
      .slice(0, 5);

    if (!topic && !speakingGoal && !guidingQuestions.length) return '';

    return [
      'Next practice context (private guidance):',
      topic ? `Topic: ${topic}` : '',
      speakingGoal ? `Speaking goal: ${speakingGoal}` : '',
      guidingQuestions.length
        ? `Possible directions: ${guidingQuestions.join(' / ')}`
        : '',
      recallTargets.length
        ? `Recall words: ${recallTargets.join(', ')}. Never quiz the user or force these words; use them only as quiet background context.`
        : '',
      'Open or continue this topic naturally, and immediately follow the user if they choose another topic.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private async authenticate(request: IncomingMessage): Promise<boolean> {
    const sessionToken = this.readCookie(request.headers.cookie, 'session');
    if (!sessionToken) return false;
    const session = await this.sessionService.validateSession(sessionToken);
    if (!session) return false;

    if (this.configService.get<string>('WHITELIST_ENABLED') !== 'true')
      return true;
    const allowedIds = new Set(
      (this.configService.get<string>('WHITELIST_USER_IDS') ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    );
    return allowedIds.has(session.user.id);
  }

  private handleClient(client: WebSocket): void {
    if (!this.apiKey) {
      client.close(1011, 'OpenAI API key is not configured');
      return;
    }

    let upstream: WebSocket | undefined;
    let configured = false;

    const closeBoth = () => {
      if (upstream?.readyState === WebSocket.OPEN) upstream.close();
      if (client.readyState === WebSocket.OPEN) client.close();
    };

    client.on('message', (raw) => {
      let event: ClientEvent;
      try {
        event = JSON.parse(this.rawDataToString(raw)) as ClientEvent;
      } catch {
        client.send(
          JSON.stringify({ type: 'error', error: { message: '事件格式錯誤' } }),
        );
        return;
      }

      if (event.type === 'session.configure' && !configured) {
        if (!this.isSupportedVoice(event.voice)) {
          client.send(
            JSON.stringify({
              type: 'error',
              error: {
                message: `不支援的 Realtime voice：${event.voice || '(empty)'}`,
              },
            }),
          );
          return;
        }
        configured = true;
        upstream = this.openUpstream(client, event, closeBoth);
        return;
      }

      if (!upstream || upstream.readyState !== WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: 'error',
            error: { message: 'Realtime 尚未就緒' },
          }),
        );
        return;
      }

      upstream.send(JSON.stringify(event));
      if (event.type === 'input_audio_buffer.commit') {
        upstream.send(JSON.stringify({ type: 'response.create' }));
      }
    });

    client.on('close', closeBoth);
    client.on('error', closeBoth);
  }

  private openUpstream(
    client: WebSocket,
    config: ConfigureEvent,
    closeBoth: () => void,
  ): WebSocket {
    const upstream = new WebSocket(
      `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(this.model)}`,
      { headers: { Authorization: `Bearer ${this.apiKey}` } },
    );

    let readySent = false;

    upstream.on('open', () => {
      upstream.send(JSON.stringify(this.buildSessionUpdate(config)));
    });

    upstream.on('message', (data) => {
      const raw = this.rawDataToString(data);
      const event = this.parseEvent(raw);
      if (event?.['type'] === 'session.updated' && !readySent) {
        readySent = true;
        for (const item of config.history ?? []) {
          const text = item.text?.trim();
          if (!text) continue;
          upstream.send(
            JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'message',
                role: item.role,
                content: [
                  item.role === 'assistant'
                    ? { type: 'output_text', text }
                    : { type: 'input_text', text },
                ],
              },
            }),
          );
        }
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'flashmind.session.ready' }));
        }
        return;
      }
      const memoryCalls = this.readMemoryCalls(event);
      if (memoryCalls.length > 0) {
        for (const call of memoryCalls) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                type: 'flashmind.memory.updated',
                ...call.payload,
              }),
            );
          }
          upstream.send(
            JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: call.callId,
                output: JSON.stringify({ success: true }),
              },
            }),
          );
        }
        upstream.send(JSON.stringify({ type: 'response.create' }));
        return;
      }
      if (client.readyState === WebSocket.OPEN) client.send(raw);
    });
    upstream.on('error', () => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: 'error',
            error: { message: 'OpenAI Realtime 連線失敗' },
          }),
        );
      }
    });
    upstream.on('close', closeBoth);
    return upstream;
  }

  private readCookie(header: string | undefined, name: string): string | null {
    if (!header) return null;
    for (const part of header.split(';')) {
      const [key, ...valueParts] = part.trim().split('=');
      if (key === name) return decodeURIComponent(valueParts.join('='));
    }
    return null;
  }

  private rawDataToString(data: RawData): string {
    if (Array.isArray(data)) {
      return Buffer.concat(data).toString('utf8');
    }
    if (data instanceof ArrayBuffer) {
      return Buffer.from(data).toString('utf8');
    }
    return data.toString('utf8');
  }

  private isSupportedVoice(voice: string | undefined): boolean {
    return new Set([
      'alloy',
      'ash',
      'ballad',
      'coral',
      'echo',
      'sage',
      'shimmer',
      'verse',
      'marin',
      'cedar',
    ]).has(voice ?? '');
  }

  private isAllowedOrigin(origin: string | undefined): boolean {
    if (!origin) return false;
    const configured = (this.configService.get<string>('CORS_ORIGINS') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (configured.length > 0) return configured.includes(origin);

    return [
      /^https?:\/\/localhost:\d+$/,
      /^https?:\/\/127\.0\.0\.1:\d+$/,
      /^https?:\/\/\[::1\]:\d+$/,
      /^https?:\/\/192\.168\.\d+\.\d+:\d+$/,
      /^https?:\/\/10\.\d+\.\d+\.\d+:\d+$/,
      /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+:\d+$/,
    ].some((pattern) => pattern.test(origin));
  }

  private parseEvent(raw: string): Record<string, unknown> | null {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private readMemoryCalls(event: Record<string, unknown> | null): Array<{
    callId: string;
    payload: { memory: string; reason?: string };
  }> {
    if (event?.['type'] !== 'response.done') return [];
    const response = event['response'] as { output?: unknown[] } | undefined;
    if (!Array.isArray(response?.output)) return [];

    return response.output.flatMap((rawItem) => {
      const item = rawItem as {
        type?: string;
        name?: string;
        call_id?: string;
        arguments?: string;
      };
      if (
        item.type !== 'function_call' ||
        item.name !== 'update_memory' ||
        !item.call_id
      ) {
        return [];
      }
      try {
        const payload = JSON.parse(item.arguments ?? '{}') as {
          memory?: string;
          reason?: string;
        };
        const memory = payload.memory?.trim();
        return memory
          ? [
              {
                callId: item.call_id,
                payload: { memory, reason: payload.reason?.trim() },
              },
            ]
          : [];
      } catch {
        return [];
      }
    });
  }
}
