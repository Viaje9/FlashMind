import { describe, expect, it } from 'vitest';
import { appendLiveTranscript } from './speaking-live-transcript.domain';

describe('Live 逐字稿分組', () => {
  it('依說話者及時間合併，支援晚到片段且忽略重複事件', () => {
    let groups = appendLiveTranscript([], {
      eventId: '1',
      role: 'user',
      delta: 'Hello',
      startMs: 100,
      endMs: 300,
    });
    groups = appendLiveTranscript(groups, {
      eventId: '2',
      role: 'assistant',
      delta: 'Hi',
      startMs: 200,
      endMs: 400,
    });
    groups = appendLiveTranscript(groups, {
      eventId: '3',
      role: 'user',
      delta: ' there',
      startMs: 300,
      endMs: 600,
    });
    expect(groups.map((g) => g.text)).toEqual(['Hello there', 'Hi']);
    expect(
      appendLiveTranscript(groups, {
        eventId: '3',
        role: 'user',
        delta: ' there',
        startMs: 300,
        endMs: 600,
      }),
    ).toEqual(groups);
    groups = appendLiveTranscript(groups, {
      eventId: '4',
      role: 'user',
      delta: 'Next',
      startMs: 4000,
      endMs: 4500,
    });
    expect(groups).toHaveLength(3);
  });
});
