import { buildLiveSessionStart } from './speaking-live';

describe('GPT Live session', () => {
  it('使用獨立 Live 模型、共用 PCM 格式與既有歷史', () => {
    const event = buildLiveSessionStart({
      voice: 'marin',
      instructions: 'Speak naturally.',
      history: [{ role: 'user', text: 'Hello' }],
    });
    expect(event).toMatchObject({
      type: 'session.start',
      session: {
        model: 'gpt-live-1',
        audio: {
          format: { type: 'audio/pcm', rate: 24000 },
          output: { voice: 'marin' },
        },
        input: [
          { role: 'user', content: [{ type: 'input_text', text: 'Hello' }] },
        ],
      },
    });
    expect(event.session).not.toHaveProperty('tools');
    expect(event.session).not.toHaveProperty('turn_detection');
  });
  it('限制啟動歷史大小並忽略空文字', () => {
    const event = buildLiveSessionStart({
      voice: 'marin',
      history: Array.from({ length: 150 }, () => ({
        role: 'assistant' as const,
        text: 'a'.repeat(1000),
      })),
    });
    expect(event.session.input!.length).toBeLessThanOrEqual(128);
    expect(JSON.stringify(event.session.input).length).toBeLessThan(24000);
  });
});

jest.mock('openai/resources/live/ws', () => {
  const { EventEmitter } = jest.requireActual('node:events');
  return {
    LiveWS: jest.fn().mockImplementation(() => {
      const live = new EventEmitter();
      live.socket = new EventEmitter();
      live.socket.readyState = 1;
      live.socket.platformSocket = { terminate: jest.fn() };
      live.send = jest.fn();
      live.close = jest.fn();
      return live;
    }),
  };
});

import { LiveWS } from 'openai/resources/live/ws';
import { SpeakingLiveConnection } from './speaking-live';
import { EventEmitter } from 'node:events';

describe('LiveWS 通道', () => {
  it('就緒後才送音訊，關閉只送一次並等待 session.closed', () => {
    const client = { readyState: 1, send: jest.fn() };
    const onClose = jest.fn();
    const connection = new SpeakingLiveConnection(
      'test-key',
      { voice: 'marin' },
      client as never,
      onClose,
    );
    const live = (LiveWS as jest.Mock).mock.results.at(-1)
      .value as EventEmitter & {
      send: jest.Mock;
      close: jest.Mock;
      socket: EventEmitter;
    };
    connection.send(
      JSON.stringify({ type: 'input_audio_buffer.append', audio: 'AAAA' }),
    );
    expect(live.send).not.toHaveBeenCalled();
    live.socket.emit('open');
    expect(live.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'session.start' }),
    );
    live.emit('event', { type: 'session.started' });
    expect(client.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'flashmind.session.ready' }),
    );
    connection.send(
      JSON.stringify({ type: 'input_audio_buffer.append', audio: 'AAAA' }),
    );
    expect(live.send).toHaveBeenLastCalledWith({
      type: 'session.input_audio.append',
      audio: 'AAAA',
    });
    connection.send(JSON.stringify({ type: 'response.create' }));
    expect(live.send).toHaveBeenCalledTimes(2);
    connection.close();
    connection.close();
    expect(live.send).toHaveBeenLastCalledWith({ type: 'session.close' });
    expect(live.close).not.toHaveBeenCalled();
    live.emit('event', { type: 'session.closed', usage: {} });
    expect(live.close).toHaveBeenCalledTimes(1);
    live.socket.emit('close');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
