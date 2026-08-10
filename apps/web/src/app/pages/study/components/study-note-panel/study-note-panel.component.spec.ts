import '@angular/compiler';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StudyStore } from '../../../../components/study/study.store';
import { StudyNotePanelComponent } from './study-note-panel.component';

describe('StudyNotePanelComponent', () => {
  let fixture: ComponentFixture<StudyNotePanelComponent>;
  let component: StudyNotePanelComponent;
  let saveCardNote: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    localStorage.clear();
    saveCardNote = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [StudyNotePanelComponent],
      providers: [{ provide: StudyStore, useValue: { saveCardNote } }],
    })
      .overrideComponent(StudyNotePanelComponent, {
        set: { template: '', styles: [] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(StudyNotePanelComponent);
    fixture.componentRef.setInput('cardId', 'card-1');
    fixture.componentRef.setInput('word', 'occur');
    fixture.componentRef.setInput('note', '原本的備註');
    fixture.detectChanges();
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
  });

  it('停止輸入 600ms 後應自動儲存最新草稿', async () => {
    component.onDraftInput('新的備註');

    await vi.advanceTimersByTimeAsync(599);
    expect(saveCardNote).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(saveCardNote).toHaveBeenCalledWith('card-1', '新的備註');
    expect(component.saveStatus()).toBe('saved');
  });

  it('關閉浮窗時應立即儲存尚未完成 debounce 的內容', async () => {
    component.panelOpen.set(true);
    component.onDraftInput('關閉前的內容');

    component.togglePanel();
    await component.flushPendingSave();

    expect(component.panelOpen()).toBe(false);
    expect(saveCardNote).toHaveBeenCalledWith('card-1', '關閉前的內容');
  });

  it('儲存失敗時應保留草稿並允許重試', async () => {
    saveCardNote.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    component.onDraftInput('不能遺失的內容');

    expect(await component.flushPendingSave()).toBe(false);
    expect(component.draft()).toBe('不能遺失的內容');
    expect(component.saveStatus()).toBe('error');

    expect(await component.flushPendingSave()).toBe(true);
    expect(saveCardNote).toHaveBeenCalledTimes(2);
    expect(component.saveStatus()).toBe('saved');
  });

  it('拖曳到畫面頂端時應限制在安全邊界並記住位置', () => {
    const panel = {
      getBoundingClientRect: () => ({ top: 132 }),
      setPointerCapture: vi.fn(),
      hasPointerCapture: () => false,
    };
    const target = {
      closest: (selector: string) =>
        selector === '[data-study-note-drag-handle="true"]' ? {} : null,
    };

    component.onPanelPointerDown({
      target,
      currentTarget: panel,
      pointerId: 7,
      clientY: 150,
      preventDefault: vi.fn(),
    } as unknown as PointerEvent);
    component.onPanelPointerMove({
      pointerId: 7,
      clientY: 2,
      preventDefault: vi.fn(),
    } as unknown as PointerEvent);
    component.onPanelPointerEnd({
      currentTarget: panel,
      pointerId: 7,
    } as unknown as PointerEvent);

    expect(component.panelTop()).toBe(12);
    expect(localStorage.getItem('flashmind.study-note-panel-top')).toBe('12');
  });

  it('調整高度後應保留尺寸設定供下一張卡片使用', () => {
    const handle = {
      setPointerCapture: vi.fn(),
      hasPointerCapture: () => false,
    };

    component.onResizePointerDown({
      currentTarget: handle,
      pointerId: 9,
      clientY: 400,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as PointerEvent);
    component.onResizePointerMove({
      pointerId: 9,
      clientY: 480,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as PointerEvent);
    component.onResizePointerEnd({
      currentTarget: handle,
      pointerId: 9,
    } as unknown as PointerEvent);

    expect(component.panelHeight()).toBe(400);
    expect(localStorage.getItem('flashmind.study-note-panel-height')).toBe('400');
  });

  it('備註入口本身也應能上下拖曳並記住位置', () => {
    const toggle = {
      getBoundingClientRect: () => ({ top: 700 }),
      setPointerCapture: vi.fn(),
      hasPointerCapture: () => false,
    };

    component.onTogglePointerDown({
      currentTarget: toggle,
      pointerId: 11,
      clientY: 710,
      preventDefault: vi.fn(),
    } as unknown as PointerEvent);
    component.onTogglePointerMove({
      pointerId: 11,
      clientY: 410,
      preventDefault: vi.fn(),
    } as unknown as PointerEvent);
    component.onTogglePointerEnd({
      currentTarget: toggle,
      pointerId: 11,
    } as unknown as PointerEvent);

    expect(component.toggleTop()).toBe(400);
    expect(localStorage.getItem('flashmind.study-note-toggle-top')).toBe('400');

    component.onToggleClick();
    expect(component.panelOpen()).toBe(false);
  });
});
