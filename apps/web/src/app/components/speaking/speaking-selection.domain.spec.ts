import { describe, expect, it } from 'vitest';
import {
  mergeSelectionRects,
  findSelectionWord,
  snapSelectionPoint,
  selectionMagnifierView,
} from './speaking-selection.domain';

describe('自訂選字範圍與座標', () => {
  it('放大鏡靠左時保持原文在視窗內，游標移到左側', () => {
    const view = selectionMagnifierView(300, { x: 16, y: 40 }, 20);
    expect(view.offsetX).toBe(0);
    expect(view.caretX).toBe(24);
  });
  it('放大鏡靠右時不露出原文右側空白，游標移到右側', () => {
    const view = selectionMagnifierView(300, { x: 284, y: 40 }, 20);
    expect(view.offsetX).toBe(-270);
    expect(view.caretX).toBe(156);
  });
  it('放大鏡只裁切目前文字行，中央位置仍對齊游標', () => {
    const view = selectionMagnifierView(300, { x: 150, y: 40 }, 20);
    expect(view.caretX).toBe(90);
    expect(view.lineHeight).toBe(34);
    expect(view.offsetY + 40 * 1.5).toBe(17);
  });
  it('中文長按只選詞，不把整串中文全選', () => {
    expect(findSelectionWord('今天正在工作', 1)).toEqual({ start: 0, end: 2 });
  });
  it('從英文中間長按仍選完整單字', () => {
    expect(findSelectionWord('before I started working', 12)).toEqual({ start: 9, end: 16 });
  });
  it('不把空字串當成可選範圍', () => {
    expect(findSelectionWord('', 0)).toBeNull();
  });
  it('同一行跨粗體的相鄰反白合併，避免重疊變深', () => {
    expect(
      mergeSelectionRects([
        { left: 20, top: 10, width: 40, height: 24 },
        { left: 50, top: 10, width: 30, height: 24 },
        { left: 20, top: 42, width: 50, height: 24 },
      ]),
    ).toEqual([
      { left: 20, top: 10, width: 60, height: 24 },
      { left: 20, top: 42, width: 50, height: 24 },
    ]);
  });
  it('手指超出短行末端時貼齊該行，不跳到下一段', () => {
    expect(
      snapSelectionPoint(
        [
          { left: 20, top: 10, width: 80, height: 24 },
          { left: 20, top: 42, width: 160, height: 24 },
        ],
        { x: 200, y: 25 },
      ),
    ).toEqual({ x: 99.5, y: 22 });
  });
});
