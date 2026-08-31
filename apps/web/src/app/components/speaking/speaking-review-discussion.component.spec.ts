import '@angular/compiler';
import { signal, ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeakingReviewDiscussionComponent } from './speaking-review-discussion.component';
import { SpeakingReviewDiscussionStore } from './speaking-review-discussion.store';
import { SpeakingStore } from './speaking.store';

describe('Speaking 回顧行動版選字手勢', () => {
  let fixture: ComponentFixture<SpeakingReviewDiscussionComponent>;
  let component: SpeakingReviewDiscussionComponent;
  let text: HTMLElement;
  let caretOffset: number;

  beforeEach(async () => {
    await resolveComponentResources(async () => '');
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    // jsdom 不做排版；只替換座標查字 API，手勢由真正的 DOM event listener 處理。
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => new DOMRect(20, 100, 180, 24),
    });
    Object.defineProperty(document, 'caretRangeFromPoint', {
      configurable: true,
      value: () => {
        const range = document.createRange();
        range.setStart(text.firstChild!, caretOffset);
        range.collapse(true);
        return range;
      },
    });
    await TestBed.configureTestingModule({ imports: [SpeakingReviewDiscussionComponent] })
      .overrideComponent(SpeakingReviewDiscussionComponent, {
        set: {
          imports: [],
          template:
            '<p data-speaking-selection-context="review-discussion" data-speaking-selection-message-id="source">One two three four.</p>',
          styles: [],
          styleUrl: undefined,
          providers: [
            { provide: SpeakingStore, useValue: {} },
            {
              provide: SpeakingReviewDiscussionStore,
              useValue: {
                start: vi.fn(),
                messages: signal([]),
                sending: signal(false),
                markedContexts: signal([]),
              },
            },
          ],
        },
      })
      .compileComponents();
    fixture = TestBed.createComponent(SpeakingReviewDiscussionComponent);
    component = fixture.componentInstance;
    // Vitest 使用 JIT，沒有 Angular build 產生的 signal input metadata。
    Object.defineProperties(component, {
      conversation: { value: signal({ id: 'original', title: '練習' }) },
      sourceMessages: { value: signal([]) },
    });
    fixture.detectChanges();
    text = fixture.nativeElement.querySelector('p');
    caretOffset = 1;
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
    Reflect.deleteProperty(document, 'caretRangeFromPoint');
    Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect');
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function pointer(type: string, x = 20, y = 100, pointerId = 1, pointerType = 'touch') {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, {
      pointerId,
      pointerType,
      isPrimary: pointerId === 1,
      clientX: x,
      clientY: y,
    });
    text.dispatchEvent(event);
    return event;
  }

  function touch(type: string, x = 20, y = 100, count = 1) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, {
      touches: Array.from({ length: count }, (_, identifier) => ({
        identifier,
        clientX: x,
        clientY: y,
        target: text,
      })),
    });
    text.dispatchEvent(event);
    return event;
  }

  it('長按成立後取消 touchmove 的原生捲動，並繼續延伸選取', () => {
    pointer('pointerdown');
    touch('touchstart');
    vi.advanceTimersByTime(320);
    expect(component.mobileSelectionActive()).toBe(true);
    expect(component.mobileSelectionDraft()?.selectedText).toBe('One');

    caretOffset = 13;
    pointer('pointermove', 20, 150);
    expect(touch('touchmove', 20, 150).defaultPrevented).toBe(true);
    expect(component.mobileSelectionDraft()?.selectedText).toContain('two three');
  });

  it('等待長按的小幅手指晃動不能提早交給瀏覽器捲動', () => {
    pointer('pointerdown');
    touch('touchstart');
    pointer('pointermove', 22, 103);
    expect(touch('touchmove', 22, 103).defaultPrevented).toBe(true);
    vi.advanceTimersByTime(320);
    expect(component.mobileSelectionActive()).toBe(true);
  });

  it('長按前直接滑動應保留原生捲動，之後不會誤啟動選字', () => {
    pointer('pointerdown');
    touch('touchstart');
    pointer('pointermove', 20, 140);
    expect(touch('touchmove', 20, 140).defaultPrevented).toBe(false);
    vi.advanceTimersByTime(400);
    expect(component.mobileSelectionActive()).toBe(false);
    expect(component.mobileSelectionDraft()).toBeNull();
  });

  it('放手保留選字工具列，但新的滑動可正常捲頁', () => {
    pointer('pointerdown');
    vi.advanceTimersByTime(320);
    pointer('pointerup');
    expect(component.mobileSelectionActive()).toBe(false);
    expect(component.selectionActionVisible()).toBe(true);
    expect(touch('touchmove', 20, 150).defaultPrevented).toBe(false);
  });

  it('第二根手指不應覆寫第一根手指的選取，且允許多指手勢', () => {
    pointer('pointerdown');
    vi.advanceTimersByTime(320);
    pointer('pointerdown', 40, 100, 2);
    touch('touchstart', 40, 100, 2);
    expect(component.mobileSelectionActive()).toBe(false);
    expect(component.mobileSelectionDraft()).toBeNull();
    expect(touch('touchmove', 40, 150, 2).defaultPrevented).toBe(false);
    vi.advanceTimersByTime(400);
    expect(component.mobileSelectionActive()).toBe(false);
  });

  it('取消手勢後不再攔截捲動', () => {
    pointer('pointerdown');
    vi.advanceTimersByTime(320);
    pointer('pointercancel');
    expect(component.mobileSelectionDraft()).toBeNull();
    expect(touch('touchmove', 20, 150).defaultPrevented).toBe(false);
  });

  it('瀏覽器已接手不可取消的捲動時應清除選取，而非硬鎖頁面', () => {
    pointer('pointerdown');
    vi.advanceTimersByTime(320);
    const event = new Event('touchmove', { bubbles: true, cancelable: false });
    Object.assign(event, { touches: [{ clientX: 20, clientY: 150 }] });
    text.dispatchEvent(event);
    expect(component.mobileSelectionActive()).toBe(false);
    expect(component.mobileSelectionDraft()).toBeNull();
    expect(event.defaultPrevented).toBe(false);
  });

  it('切換視窗會清除長按狀態並恢復捲頁', () => {
    pointer('pointerdown');
    vi.advanceTimersByTime(320);
    window.dispatchEvent(new Event('blur'));
    expect(component.mobileSelectionActive()).toBe(false);
    expect(touch('touchmove', 20, 150).defaultPrevented).toBe(false);
  });

  it('離開頁面會清除尚未觸發的長按計時器', () => {
    const removeListener = vi.spyOn(fixture.nativeElement, 'removeEventListener');
    pointer('pointerdown');
    fixture.destroy();
    vi.advanceTimersByTime(400);
    expect(component.mobileSelectionActive()).toBe(false);
    expect(component.mobileSelectionDraft()).toBeNull();
    expect(removeListener).toHaveBeenCalledWith('touchmove', expect.any(Function), true);
    expect(removeListener).toHaveBeenCalledWith('touchstart', expect.any(Function), true);
  });

  it('滑鼠操作不應啟動行動版手勢或攔截觸控捲動', () => {
    pointer('pointerdown', 20, 100, 1, 'mouse');
    vi.advanceTimersByTime(400);
    expect(component.mobileSelectionActive()).toBe(false);
    expect(touch('touchmove', 20, 150).defaultPrevented).toBe(false);
  });
});
