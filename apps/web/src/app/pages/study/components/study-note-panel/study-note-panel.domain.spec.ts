import { describe, expect, it } from 'vitest';
import {
  clampStudyNotePanelBounds,
  hasUnsavedStudyNote,
  normalizeStudyNoteForRequest,
} from './study-note-panel.domain';

describe('study-note-panel.domain', () => {
  describe('normalizeStudyNoteForRequest', () => {
    it.each([[''], ['   '], ['\n\t']])('空白備註 %p 應轉為 null', (value) => {
      expect(normalizeStudyNoteForRequest(value)).toBeNull();
    });

    it('非空備註應保留原始換行與空白', () => {
      expect(normalizeStudyNoteForRequest('  第一行\n第二行  ')).toBe('  第一行\n第二行  ');
    });
  });

  it('草稿與已儲存內容不同時應標示尚未儲存', () => {
    expect(hasUnsavedStudyNote('新內容', '舊內容')).toBe(true);
    expect(hasUnsavedStudyNote('', null)).toBe(false);
  });

  it('應將面板限制在 iPhone 安全區與可視高度內', () => {
    expect(
      clampStudyNotePanelBounds({
        top: 0,
        height: 900,
        viewportHeight: 844,
        safeAreaTop: 47,
        topMargin: 12,
        safeBottom: 12,
        minHeight: 220,
      }),
    ).toEqual({ top: 59, height: 773 });
  });

  it('螢幕縮小時應同時修正既有位置與高度', () => {
    expect(
      clampStudyNotePanelBounds({
        top: 500,
        height: 400,
        viewportHeight: 664,
        safeAreaTop: 20,
        topMargin: 12,
        safeBottom: 12,
        minHeight: 220,
      }),
    ).toEqual({ top: 252, height: 400 });
  });
});
