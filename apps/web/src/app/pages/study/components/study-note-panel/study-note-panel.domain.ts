export interface StudyNotePanelBoundsInput {
  top: number;
  height: number;
  viewportHeight: number;
  safeAreaTop: number;
  topMargin: number;
  safeBottom: number;
  minHeight: number;
}

export interface StudyNotePanelBounds {
  top: number;
  height: number;
}

export function normalizeStudyNoteForRequest(value: string): string | null {
  return value.trim() ? value : null;
}

export function hasUnsavedStudyNote(draft: string, saved: string | null): boolean {
  return normalizeStudyNoteForRequest(draft) !== normalizeStudyNoteForRequest(saved ?? '');
}

export function clampStudyNotePanelBounds({
  top,
  height,
  viewportHeight,
  safeAreaTop,
  topMargin,
  safeBottom,
  minHeight,
}: StudyNotePanelBoundsInput): StudyNotePanelBounds {
  const minTop = Math.max(topMargin, Math.ceil(safeAreaTop + topMargin));
  const maxHeight = Math.max(minHeight, viewportHeight - minTop - safeBottom);
  const clampedHeight = Math.min(Math.max(height, minHeight), maxHeight);
  const maxTop = Math.max(minTop, viewportHeight - clampedHeight - safeBottom);
  const clampedTop = Math.min(Math.max(top, minTop), maxTop);

  return { top: clampedTop, height: clampedHeight };
}
