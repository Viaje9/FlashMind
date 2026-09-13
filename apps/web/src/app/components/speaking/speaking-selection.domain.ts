export interface SelectionRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function selectionMagnifierView(
  sourceWidth: number,
  point: { x: number; y: number },
  textHeight: number,
) {
  // 184 × 60 的鏡框扣除兩側 2px 邊框；靠邊時移動游標而非露出訊息外空白。
  const width = 180;
  const scale = 1.5;
  const offsetX =
    0 - Math.max(0, Math.min(sourceWidth * scale - width, point.x * scale - width / 2));
  const lineHeight = Math.min(44, textHeight * scale + 4);
  return {
    offsetX,
    offsetY: lineHeight / 2 - point.y * scale,
    caretX: Math.max(2, Math.min(width - 2, point.x * scale + offsetX)),
    lineHeight,
    lineTop: (56 - lineHeight) / 2,
  };
}

export function findSelectionWord(
  text: string,
  offset: number,
): { start: number; end: number } | null {
  if (!text) return null;
  const cursor = Math.max(0, Math.min(offset, text.length - 1));
  if (typeof Intl.Segmenter === 'function') {
    const segments = new Intl.Segmenter('zh-Hant', { granularity: 'word' }).segment(text);
    const item = segments.containing(cursor);
    if (item?.isWordLike) return { start: item.index, end: item.index + item.segment.length };
    if (item && item.segment.trim())
      return { start: item.index, end: item.index + item.segment.length };
  }
  let start = cursor;
  let end = cursor + 1;
  if (/\s/u.test(text[cursor])) return null;
  while (start > 0 && /[A-Za-z0-9'’-]/u.test(text[start - 1])) start--;
  while (end < text.length && /[A-Za-z0-9'’-]/u.test(text[end])) end++;
  return { start, end };
}

export function mergeSelectionRects(rects: readonly SelectionRect[]): SelectionRect[] {
  const result: SelectionRect[] = [];
  for (const rect of [...rects]
    .filter((r) => r.width > 0 && r.height > 0)
    .sort((a, b) => (Math.abs(a.top - b.top) < 2 ? a.left - b.left : a.top - b.top))) {
    const previous = result.at(-1);
    if (
      previous &&
      Math.abs(previous.top - rect.top) < 2 &&
      Math.abs(previous.height - rect.height) < 2 &&
      rect.left <= previous.left + previous.width + 1
    ) {
      previous.width =
        Math.max(previous.left + previous.width, rect.left + rect.width) - previous.left;
    } else {
      result.push({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    }
  }
  return result;
}

export function snapSelectionPoint(
  rects: readonly SelectionRect[],
  point: { x: number; y: number },
) {
  let best: SelectionRect | undefined;
  let distance = Infinity;
  for (const rect of rects) {
    const dy = Math.abs(point.y - (rect.top + rect.height / 2));
    const dx = Math.max(rect.left - point.x, point.x - rect.left - rect.width, 0);
    const score = dy * 10000 + dx;
    if (score < distance) {
      best = rect;
      distance = score;
    }
  }
  return best
    ? {
        x: Math.max(best.left + 0.5, Math.min(best.left + best.width - 0.5, point.x)),
        y: best.top + best.height / 2,
      }
    : point;
}
