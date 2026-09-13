import '@angular/compiler';
import { signal, ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeakingReviewDiscussionComponent } from './speaking-review-discussion.component';
import { SpeakingReviewDiscussionStore } from './speaking-review-discussion.store';
import { SpeakingStore } from './speaking.store';
import { TtsStore } from '../tts/tts.store';

describe('Speaking 回顧行動版選字手勢', () => {
  let fixture: ComponentFixture<SpeakingReviewDiscussionComponent>;
  let component: SpeakingReviewDiscussionComponent;
  let text: HTMLElement;
  let caretOffset: number;
  let tts: ReturnType<typeof createTtsMock>;

  function createTtsMock() {
    return {
      play: vi.fn().mockResolvedValue(undefined),
      playWord: vi.fn(),
      stop: vi.fn(),
      clearError: vi.fn(),
      loadingText: signal<string | null>(null),
      playingText: signal<string | null>(null),
      error: signal<string | null>(null),
    };
  }

  beforeEach(async () => {
    await resolveComponentResources(async () => '');
    vi.useFakeTimers();
    tts = createTtsMock();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    // jsdom 不做排版；只替換座標查字 API，手勢由真正的 DOM event listener 處理。
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => new DOMRect(20, 100, 180, 24),
    });
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => [new DOMRect(20, 100, 180, 24)],
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
            { provide: TtsStore, useValue: tts },
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
    createFixture();
    caretOffset = 1;
  });

  function createFixture() {
    fixture = TestBed.createComponent(SpeakingReviewDiscussionComponent);
    component = fixture.componentInstance;
    // Vitest 使用 JIT，沒有 Angular build 產生的 signal input metadata。
    Object.defineProperties(component, {
      conversation: { value: signal({ id: 'original', title: '練習' }) },
      sourceMessages: { value: signal([]) },
    });
    fixture.detectChanges();
    text = fixture.nativeElement.querySelector('p');
  }

  function useAppleTouchDevice(
    userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
  ) {
    fixture.destroy();
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
    createFixture();
  }

  it('iPhone 使用自訂選取並在長按後阻止原生選單', () => {
    useAppleTouchDevice();
    expect(component.mobileSelectionEnabled()).toBe(true);
    pointer('pointerdown');
    touch('touchstart');
    vi.advanceTimersByTime(400);
    expect(touch('touchmove', 20, 150).defaultPrevented).toBe(true);
    expect(component.mobileSelectionDraft()?.selectedText).toBe('One');
    const menu = new Event('contextmenu', { bubbles: true, cancelable: true });
    text.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
  });

  it('iPad 觸控模式也使用自訂選字', () => {
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
    useAppleTouchDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)');
    expect(component.mobileSelectionEnabled()).toBe(true);
  });

  it('滑鼠事件不會中斷同時進行的觸控長按', () => {
    pointer('pointerdown');
    pointer('pointermove', 250, 100, 1, 'mouse');
    pointer('pointerup', 250, 100, 1, 'mouse');
    vi.advanceTimersByTime(320);
    expect(component.mobileSelectionDraft()?.selectedText).toBe('One');
  });

  it('WebKit 無法查詢禁止原生選取的文字時，以快取字元座標拖曳', () => {
    Object.defineProperty(document, 'caretRangeFromPoint', {
      configurable: true,
      value: () => null,
    });
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: function (this: Range) {
        return [
          new DOMRect(this.startOffset * 10, 100, (this.endOffset - this.startOffset) * 10, 24),
        ];
      },
    });
    pointer('pointerdown', 12, 112);
    vi.advanceTimersByTime(320);
    expect(component.mobileSelectionDraft()?.selectedText).toBe('One');
    pointer('pointermove', 129, 112);
    vi.advanceTimersByTime(17);
    expect(component.mobileSelectionDraft()?.selectedText).toBe('One two three');
  });

  it('多次移動合併成一個畫面更新，保留原文字節點', () => {
    useAppleTouchDevice();
    const originalNode = text.firstChild;
    pointer('pointerdown');
    vi.advanceTimersByTime(320);
    fixture.detectChanges();
    const caret = vi.spyOn(
      document as Document & { caretRangeFromPoint: () => Range },
      'caretRangeFromPoint',
    );
    caretOffset = 13;
    for (let i = 0; i < 20; i++) pointer('pointermove', 25 + i, 110);
    expect(caret).not.toHaveBeenCalled();
    vi.advanceTimersByTime(17);
    fixture.detectChanges();
    expect(caret).toHaveBeenCalledTimes(1);
    expect(component.selectionTranslateTarget()?.selectedText).toBe('One two three');
    expect(text.firstChild).toBe(originalNode);
    expect(text.querySelector('.speaking-mobile-selection')).toBeNull();
  });

  it('放開前最後一次移動即使還沒到下一幀仍會套用', () => {
    useAppleTouchDevice();
    pointer('pointerdown');
    vi.advanceTimersByTime(320);
    caretOffset = 13;
    pointer('pointermove', 50, 110);
    pointer('pointerup', 50, 110);
    expect(component.mobileSelectionDraft()?.selectedText).toBe('One two three');
    expect(component.selectionActionVisible()).toBe(true);
  });

  it('取消手勢後不再執行尚未完成的畫面更新', () => {
    useAppleTouchDevice();
    pointer('pointerdown');
    vi.advanceTimersByTime(320);
    pointer('pointermove', 50, 110);
    pointer('pointercancel');
    vi.advanceTimersByTime(32);
    expect(component.mobileSelectionDraft()?.selectedText).toBe('One');
    expect(component.selectionActionsSuppressed()).toBe(true);
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
    Reflect.deleteProperty(document, 'caretRangeFromPoint');
    Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect');
    Reflect.deleteProperty(Range.prototype, 'getClientRects');
    Reflect.deleteProperty(navigator, 'maxTouchPoints');
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(['start', 'end'] as const)('放開後可拖曳 %s 端點並顯示放大文字', (edge) => {
    component.mobileSelectionDraft.set({
      messageId: 'source',
      start: 4,
      end: 13,
      selectedText: 'two three',
    });
    const event = new Event('pointerdown', { cancelable: true });
    Object.assign(event, { pointerId: 9, isPrimary: true, clientX: 20, clientY: 100 });
    Object.defineProperty(event, 'currentTarget', { value: text });
    component.onSelectionHandleDown(event as PointerEvent, edge);
    caretOffset = edge === 'start' ? 0 : 18;
    const move = new Event('pointermove', { cancelable: true });
    Object.assign(move, { pointerId: 9, clientX: 40, clientY: 100 });
    component.onDocumentPointerMove(move as PointerEvent);
    vi.advanceTimersByTime(17);
    expect(component.mobileSelectionDraft()?.selectedText).toBe(
      edge === 'start' ? 'One two three' : 'two three four',
    );
    expect(component.selectionMagnifier()).not.toBeNull();
    component.onDocumentPointerUp(move as PointerEvent);
    expect(component.selectionMagnifier()).toBeNull();
    expect(component.mobileSelectionDraft()).not.toBeNull();
  });

  it.each(['input', 'textarea', 'div'])('編輯 %s 時保留原生選取與組字狀態', (tag) => {
    const editor = document.createElement(tag);
    if (tag === 'div') {
      editor.setAttribute('contenteditable', 'true');
      editor.tabIndex = 0;
    }
    fixture.nativeElement.appendChild(editor);
    editor.focus();
    expect(document.activeElement).toBe(editor);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(text);
    selection.addRange(range);
    const clear = vi.spyOn(selection, 'removeAllRanges');

    editor.dispatchEvent(new Event('selectionchange', { bubbles: true }));

    expect(clear).not.toHaveBeenCalled();
    editor.remove();
  });

  it('手機版仍會清除對話文字區內的原生選取', () => {
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(text);
    selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    expect(selection.rangeCount).toBe(0);
  });

  it('手機版不清除對話文字區以外的選取', () => {
    const other = document.createElement('p');
    other.textContent = '其他區域';
    fixture.nativeElement.appendChild(other);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(other);
    selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    expect(selection.toString()).toBe('其他區域');
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
    vi.advanceTimersByTime(17);
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

  it('捲頁保留反白並收起工具列，輕點反白再顯示', () => {
    pointer('pointerdown');
    vi.advanceTimersByTime(320);
    pointer('pointerup');
    window.dispatchEvent(new Event('scroll'));
    expect(component.mobileSelectionDraft()?.selectedText).toBe('One');
    expect(component.selectionActionsSuppressed()).toBe(true);
    pointer('pointerdown', 40, 110);
    pointer('pointerup', 40, 110);
    expect(component.mobileSelectionDraft()?.selectedText).toBe('One');
    expect(component.selectionActionsSuppressed()).toBe(false);
  });

  it('從選取外開始滑動不取消反白，真正輕點外面才清除', () => {
    pointer('pointerdown');
    vi.advanceTimersByTime(320);
    pointer('pointerup');
    pointer('pointerdown', 220, 150);
    expect(component.mobileSelectionDraft()?.selectedText).toBe('One');
    pointer('pointermove', 220, 200);
    pointer('pointercancel', 220, 200);
    window.dispatchEvent(new Event('scroll'));
    expect(component.mobileSelectionDraft()?.selectedText).toBe('One');
    pointer('pointerdown', 220, 150);
    pointer('pointerup', 220, 150);
    expect(component.mobileSelectionDraft()).toBeNull();
    vi.advanceTimersByTime(400);
    expect(component.mobileSelectionDraft()).toBeNull();
  });

  it('第二根手指不應覆寫第一根手指的選取，且允許多指手勢', () => {
    pointer('pointerdown');
    vi.advanceTimersByTime(320);
    pointer('pointerdown', 40, 100, 2);
    touch('touchstart', 40, 100, 2);
    expect(component.mobileSelectionActive()).toBe(false);
    expect(component.mobileSelectionDraft()?.selectedText).toBe('One');
    expect(touch('touchmove', 40, 150, 2).defaultPrevented).toBe(false);
    vi.advanceTimersByTime(400);
    expect(component.mobileSelectionActive()).toBe(false);
  });

  it('取消手勢後不再攔截捲動', () => {
    pointer('pointerdown');
    vi.advanceTimersByTime(320);
    pointer('pointercancel');
    expect(component.mobileSelectionDraft()?.selectedText).toBe('One');
    expect(touch('touchmove', 20, 150).defaultPrevented).toBe(false);
  });

  it('瀏覽器接手捲動時保留反白並停止攔截手勢', () => {
    pointer('pointerdown');
    vi.advanceTimersByTime(320);
    const event = new Event('touchmove', { bubbles: true, cancelable: false });
    Object.assign(event, { touches: [{ clientX: 20, clientY: 150 }] });
    text.dispatchEvent(event);
    expect(component.mobileSelectionActive()).toBe(false);
    expect(component.mobileSelectionDraft()?.selectedText).toBe('One');
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

  it('選取單字也使用句子 TTS，不走 Google 單字語音', async () => {
    component.selectionTranslateTarget.set({ messageId: 'source', selectedText: 'Hello' });
    await component.onSelectionSpeechActionClick();
    expect(tts.play).toHaveBeenCalledWith('Hello');
    expect(tts.playWord).not.toHaveBeenCalled();
  });

  it('沒有選字或相同文字正在載入時不重複請求', async () => {
    await component.onSelectionSpeechActionClick();
    component.selectionTranslateTarget.set({ messageId: 'source', selectedText: 'Hello' });
    tts.loadingText.set('Hello');
    expect(component.selectionSpeechLoading()).toBe(true);
    await component.onSelectionSpeechActionClick();
    expect(tts.play).not.toHaveBeenCalled();
  });

  it('朗讀中再次按下交由播放器暫停，且不清除選取', async () => {
    component.selectionTranslateTarget.set({ messageId: 'source', selectedText: 'Hello' });
    tts.playingText.set('Hello');
    expect(component.selectionSpeechPlaying()).toBe(true);
    await component.onSelectionSpeechActionClick();
    expect(tts.play).toHaveBeenCalledWith('Hello');
    expect(component.selectionActionVisible()).toBe(true);
  });

  it('超過 500 字顯示提示，不截斷送出', async () => {
    component.selectionTranslateTarget.set({ messageId: 'source', selectedText: 'a'.repeat(501) });
    await component.onSelectionSpeechActionClick();
    expect(tts.play).not.toHaveBeenCalled();
    expect(component.selectionSpeechError()).toContain('500');
  });

  it('播放失敗會顯示錯誤且可重新點擊重試', async () => {
    component.selectionTranslateTarget.set({ messageId: 'source', selectedText: 'Hello' });
    tts.play.mockImplementationOnce(async () => tts.error.set('語音播放失敗'));
    await component.onSelectionSpeechActionClick();
    expect(component.selectionSpeechError()).toBe('語音播放失敗');
    tts.error.set(null);
    await component.onSelectionSpeechActionClick();
    expect(component.selectionSpeechError()).toBeNull();
    expect(tts.play).toHaveBeenCalledTimes(2);
  });

  it('離開頁面時停止這個討論的朗讀', () => {
    fixture.destroy();
    expect(tts.stop).toHaveBeenCalled();
  });
});
