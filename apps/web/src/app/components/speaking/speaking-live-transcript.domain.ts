export interface LiveTranscriptFragment {
  eventId: string;
  role: 'user' | 'assistant';
  delta: string;
  startMs: number;
  endMs: number;
}
export interface LiveTranscriptGroup {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  startMs: number;
  endMs: number;
  fragments: LiveTranscriptFragment[];
}

// 1.5 秒只用於畫面分組，不代表模型回合或音訊播放結束。
export function appendLiveTranscript(
  groups: LiveTranscriptGroup[],
  fragment: LiveTranscriptFragment,
): LiveTranscriptGroup[] {
  if (
    !fragment.delta ||
    groups.some((group) => group.fragments.some((item) => item.eventId === fragment.eventId))
  )
    return groups;
  const target = groups.find(
    (group) =>
      group.role === fragment.role &&
      fragment.startMs <= group.endMs + 1500 &&
      fragment.endMs >= group.startMs - 1500,
  );
  const fragments = [...(target?.fragments ?? []), fragment].sort((a, b) => a.startMs - b.startMs);
  const group: LiveTranscriptGroup = {
    id: target?.id ?? fragment.eventId,
    role: fragment.role,
    text: fragments.map((item) => item.delta).join(''),
    startMs: Math.min(...fragments.map((item) => item.startMs)),
    endMs: Math.max(...fragments.map((item) => item.endMs)),
    fragments,
  };
  return [...groups.filter((item) => item !== target), group].sort((a, b) => a.startMs - b.startMs);
}
