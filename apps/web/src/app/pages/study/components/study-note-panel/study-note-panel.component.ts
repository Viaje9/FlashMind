import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { StudyStore } from '../../../../components/study/study.store';
import {
  clampStudyNotePanelBounds,
  hasUnsavedStudyNote,
  normalizeStudyNoteForRequest,
} from './study-note-panel.domain';

const NOTE_SAVE_DELAY_MS = 600;
const NOTE_PANEL_INITIAL_TOP = 132;
const NOTE_PANEL_INITIAL_HEIGHT = 320;
const NOTE_PANEL_MIN_HEIGHT = 220;
const NOTE_PANEL_SAFE_BOTTOM = 12;
const NOTE_PANEL_TOP_MARGIN = 12;
const NOTE_PANEL_TOP_STORAGE_KEY = 'flashmind.study-note-panel-top';
const NOTE_PANEL_HEIGHT_STORAGE_KEY = 'flashmind.study-note-panel-height';
const NOTE_TOGGLE_TOP_STORAGE_KEY = 'flashmind.study-note-toggle-top';
const NOTE_TOGGLE_SIZE = 44;
const NOTE_TOGGLE_SAFE_BOTTOM = 56;

type NoteSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

@Component({
  selector: 'fm-study-note-panel',
  templateUrl: './study-note-panel.component.html',
  styleUrl: './study-note-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudyNotePanelComponent implements OnInit, OnDestroy {
  private readonly studyStore = inject(StudyStore);

  readonly cardId = input.required<string>();
  readonly word = input('');
  readonly note = input<string | null>(null);

  readonly panelOpen = signal(false);
  readonly draft = signal('');
  readonly saveStatus = signal<NoteSaveStatus>('idle');
  readonly panelTop = signal(
    this.readStoredNumber(NOTE_PANEL_TOP_STORAGE_KEY, NOTE_PANEL_INITIAL_TOP),
  );
  readonly panelHeight = signal(
    this.readStoredNumber(NOTE_PANEL_HEIGHT_STORAGE_KEY, NOTE_PANEL_INITIAL_HEIGHT),
  );
  readonly toggleTop = signal<number | null>(
    this.readStoredNullableNumber(NOTE_TOGGLE_TOP_STORAGE_KEY),
  );
  readonly saveStatusText = computed(() => {
    switch (this.saveStatus()) {
      case 'saving':
        return '儲存中…';
      case 'saved':
        return '已儲存';
      case 'error':
        return '儲存失敗';
      default:
        return '停止輸入後自動儲存';
    }
  });

  private lastSavedNote: string | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private currentSave: Promise<boolean> | null = null;
  private safeAreaInsetTop = 0;
  private safeAreaInsetMeasured = false;
  private dragState = { active: false, pointerId: -1, offsetY: 0 };
  private resizeState = {
    active: false,
    pointerId: -1,
    startHeight: NOTE_PANEL_INITIAL_HEIGHT,
    startClientY: 0,
  };
  private toggleDragState = { active: false, pointerId: -1, offsetY: 0, moved: false };

  ngOnInit(): void {
    this.lastSavedNote = normalizeStudyNoteForRequest(this.note() ?? '');
    this.draft.set(this.note() ?? '');
    this.clampPanelBounds();
    this.clampToggleTop();
  }

  ngOnDestroy(): void {
    void this.flushPendingSave();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.safeAreaInsetMeasured = false;
    this.clampPanelBounds();
    this.clampToggleTop();
  }

  onToggleClick(): void {
    if (this.toggleDragState.moved) {
      this.toggleDragState.moved = false;
      return;
    }
    this.togglePanel();
  }

  onTogglePointerDown(event: PointerEvent): void {
    const toggle = event.currentTarget as HTMLElement | null;
    if (!toggle) return;

    event.preventDefault();
    const rect = toggle.getBoundingClientRect();
    this.toggleDragState = {
      active: true,
      pointerId: event.pointerId,
      offsetY: event.clientY - rect.top,
      moved: false,
    };
    toggle.setPointerCapture(event.pointerId);
  }

  onTogglePointerMove(event: PointerEvent): void {
    if (!this.toggleDragState.active || this.toggleDragState.pointerId !== event.pointerId) return;

    event.preventDefault();
    const nextTop = event.clientY - this.toggleDragState.offsetY;
    if (Math.abs(nextTop - (this.toggleTop() ?? nextTop)) > 3) {
      this.toggleDragState.moved = true;
    }
    this.toggleTop.set(this.clampToggleTopValue(nextTop));
  }

  onTogglePointerEnd(event: PointerEvent): void {
    if (this.toggleDragState.pointerId !== event.pointerId) return;

    this.toggleDragState.active = false;
    this.toggleDragState.pointerId = -1;
    this.persistNumber(NOTE_TOGGLE_TOP_STORAGE_KEY, this.toggleTop() ?? 0);
    const toggle = event.currentTarget as HTMLElement | null;
    if (toggle?.hasPointerCapture(event.pointerId)) toggle.releasePointerCapture(event.pointerId);
  }

  togglePanel(): void {
    if (this.panelOpen()) {
      void this.flushPendingSave();
      this.panelOpen.set(false);
      return;
    }

    this.panelOpen.set(true);
    this.clampPanelBounds();
  }

  onDraftInput(value: string): void {
    this.draft.set(value);
    this.saveStatus.set('idle');
    this.scheduleSave();
  }

  retrySave(): void {
    void this.flushPendingSave();
  }

  onPanelPointerDown(event: PointerEvent): void {
    const target = event.target as HTMLElement;
    if (
      !target.closest('[data-study-note-drag-handle="true"]') ||
      target.closest('button,textarea,input,select,a,[role="button"]')
    ) {
      return;
    }

    const panel = event.currentTarget as HTMLElement | null;
    if (!panel) return;

    event.preventDefault();
    const rect = panel.getBoundingClientRect();
    this.dragState = {
      active: true,
      pointerId: event.pointerId,
      offsetY: event.clientY - rect.top,
    };
    panel.setPointerCapture(event.pointerId);
  }

  onPanelPointerMove(event: PointerEvent): void {
    if (!this.dragState.active || this.dragState.pointerId !== event.pointerId) return;

    event.preventDefault();
    const bounds = this.getClampedBounds(
      event.clientY - this.dragState.offsetY,
      this.panelHeight(),
    );
    this.panelTop.set(bounds.top);
    this.panelHeight.set(bounds.height);
  }

  onPanelPointerEnd(event: PointerEvent): void {
    if (this.dragState.pointerId !== event.pointerId) return;

    this.dragState = { active: false, pointerId: -1, offsetY: 0 };
    this.persistNumber(NOTE_PANEL_TOP_STORAGE_KEY, this.panelTop());
    const panel = event.currentTarget as HTMLElement | null;
    if (panel?.hasPointerCapture(event.pointerId)) panel.releasePointerCapture(event.pointerId);
  }

  onResizePointerDown(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.resizeState = {
      active: true,
      pointerId: event.pointerId,
      startHeight: this.panelHeight(),
      startClientY: event.clientY,
    };
    (event.currentTarget as HTMLElement | null)?.setPointerCapture(event.pointerId);
  }

  onResizePointerMove(event: PointerEvent): void {
    if (!this.resizeState.active || this.resizeState.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    const nextHeight = this.resizeState.startHeight + event.clientY - this.resizeState.startClientY;
    const bounds = this.getClampedBounds(this.panelTop(), nextHeight);
    this.panelTop.set(bounds.top);
    this.panelHeight.set(bounds.height);
  }

  onResizePointerEnd(event: PointerEvent): void {
    if (this.resizeState.pointerId !== event.pointerId) return;

    this.resizeState = {
      active: false,
      pointerId: -1,
      startHeight: this.panelHeight(),
      startClientY: 0,
    };
    this.persistNumber(NOTE_PANEL_HEIGHT_STORAGE_KEY, this.panelHeight());
    const handle = event.currentTarget as HTMLElement | null;
    if (handle?.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  }

  async flushPendingSave(): Promise<boolean> {
    this.clearSaveTimer();
    if (this.currentSave) await this.currentSave;
    if (!hasUnsavedStudyNote(this.draft(), this.lastSavedNote)) return true;

    const cardId = this.cardId();
    const snapshot = this.draft();
    const normalizedNote = normalizeStudyNoteForRequest(snapshot);
    this.saveStatus.set('saving');

    const save = this.studyStore.saveCardNote(cardId, normalizedNote);
    this.currentSave = save;
    const success = await save;
    this.currentSave = null;

    if (success) {
      this.lastSavedNote = normalizedNote;
      if (this.draft() === snapshot) {
        this.saveStatus.set('saved');
      } else {
        this.scheduleSave();
      }
    } else {
      this.saveStatus.set('error');
    }

    return success;
  }

  private scheduleSave(): void {
    this.clearSaveTimer();
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.flushPendingSave();
    }, NOTE_SAVE_DELAY_MS);
  }

  private clearSaveTimer(): void {
    if (this.saveTimer === null) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }

  private clampPanelBounds(): void {
    if (typeof window === 'undefined') return;
    const bounds = this.getClampedBounds(this.panelTop(), this.panelHeight());
    this.panelTop.set(bounds.top);
    this.panelHeight.set(bounds.height);
    this.persistNumber(NOTE_PANEL_TOP_STORAGE_KEY, bounds.top);
    this.persistNumber(NOTE_PANEL_HEIGHT_STORAGE_KEY, bounds.height);
  }

  private clampToggleTop(): void {
    if (typeof window === 'undefined') return;
    const storedOrDefault =
      this.toggleTop() ?? window.innerHeight - NOTE_TOGGLE_SAFE_BOTTOM - NOTE_TOGGLE_SIZE;
    const top = this.clampToggleTopValue(storedOrDefault);
    this.toggleTop.set(top);
    this.persistNumber(NOTE_TOGGLE_TOP_STORAGE_KEY, top);
  }

  private clampToggleTopValue(top: number): number {
    const minTop = Math.max(
      NOTE_PANEL_TOP_MARGIN,
      Math.ceil(this.getSafeAreaInsetTop() + NOTE_PANEL_TOP_MARGIN),
    );
    const maxTop = Math.max(
      minTop,
      window.innerHeight - NOTE_TOGGLE_SAFE_BOTTOM - NOTE_TOGGLE_SIZE,
    );
    return Math.min(Math.max(top, minTop), maxTop);
  }

  private getClampedBounds(top: number, height: number) {
    return clampStudyNotePanelBounds({
      top,
      height,
      viewportHeight: window.innerHeight,
      safeAreaTop: this.getSafeAreaInsetTop(),
      topMargin: NOTE_PANEL_TOP_MARGIN,
      safeBottom: NOTE_PANEL_SAFE_BOTTOM,
      minHeight: NOTE_PANEL_MIN_HEIGHT,
    });
  }

  private getSafeAreaInsetTop(): number {
    if (this.safeAreaInsetMeasured) return this.safeAreaInsetTop;
    if (typeof window === 'undefined' || typeof document === 'undefined') return 0;

    const host = document.body ?? document.documentElement;
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);';
    host.appendChild(probe);
    const parsed = Number.parseFloat(window.getComputedStyle(probe).paddingTop);
    host.removeChild(probe);

    this.safeAreaInsetTop = Number.isFinite(parsed) ? parsed : 0;
    this.safeAreaInsetMeasured = true;
    return this.safeAreaInsetTop;
  }

  private readStoredNumber(key: string, fallback: number): number {
    if (typeof localStorage === 'undefined') return fallback;

    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return fallback;
      const value = Number(stored);
      return Number.isFinite(value) ? value : fallback;
    } catch {
      return fallback;
    }
  }

  private readStoredNullableNumber(key: string): number | null {
    if (typeof localStorage === 'undefined') return null;

    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return null;
      const value = Number(stored);
      return Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  }

  private persistNumber(key: string, value: number): void {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // 儲存空間不可用時仍保留本次頁面狀態。
    }
  }
}
