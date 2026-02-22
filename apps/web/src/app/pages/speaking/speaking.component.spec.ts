import '@angular/compiler';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeakingRecorderService } from '../../components/speaking/speaking-recorder.service';
import {
  SPEAKING_DEFAULT_SETTINGS,
  type SpeakingAssistantMessage,
  type SpeakingMessage,
} from '../../components/speaking/speaking.domain';
import { SpeakingStore } from '../../components/speaking/speaking.store';
import { TtsStore } from '../../components/tts/tts.store';
import { SpeakingComponent } from './speaking.component';

describe('speaking.component selection actions', () => {
  let fixture: ComponentFixture<SpeakingComponent>;
  let component: SpeakingComponent;
  let storeMock: ReturnType<typeof createSpeakingStoreMock>;
  let ttsStoreMock: ReturnType<typeof createTtsStoreMock>;

  beforeEach(async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
    });

    storeMock = createSpeakingStoreMock();
    ttsStoreMock = createTtsStoreMock();

    await TestBed.configureTestingModule({
      imports: [SpeakingComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap({})),
          },
        },
        {
          provide: Router,
          useValue: {
            navigate: vi.fn().mockResolvedValue(true),
          },
        },
        {
          provide: SpeakingStore,
          useValue: storeMock,
        },
        {
          provide: SpeakingRecorderService,
          useValue: createRecorderMock(),
        },
        {
          provide: TtsStore,
          useValue: ttsStoreMock,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SpeakingComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('assistant 文字選取時應顯示翻譯按鈕，清除選取時應隱藏', async () => {
    const assistantMessage: SpeakingMessage = {
      id: 'assistant-1',
      conversationId: 'conversation-1',
      role: 'assistant',
      text: 'Hello speaking world',
      createdAt: '2026-02-22T10:00:00.000Z',
    };

    storeMock.messages.set([assistantMessage]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const transcript = fixture.nativeElement.querySelector(
      '[data-speaking-assistant-message-id="assistant-1"]',
    ) as HTMLElement | null;
    expect(transcript).toBeTruthy();

    mockWindowSelection({
      anchorNode: transcript?.firstChild ?? transcript!,
      text: 'Hello',
      rect: new DOMRect(120, 240, 88, 20),
    });

    component.onDocumentSelectionChange();

    expect(component.selectionActionVisible()).toBe(true);
    expect(component.selectionTranslateTarget()).toEqual({
      context: 'main-transcript',
      messageId: 'assistant-1',
      selectedText: 'Hello',
    });

    mockWindowSelection({
      anchorNode: transcript?.firstChild ?? transcript!,
      text: '',
      isCollapsed: true,
    });

    component.onDocumentSelectionChange();

    expect(component.selectionActionVisible()).toBe(false);
    expect(component.selectionTranslateTarget()).toBeNull();
  });

  it('AI 助手面板 assistant 訊息選取時應顯示發音按鈕', async () => {
    const assistantPanelMessage: SpeakingAssistantMessage = {
      id: 'panel-assistant-1',
      role: 'assistant',
      content: 'Please repeat this sentence.',
      createdAt: '2026-02-22T10:10:00.000Z',
    };

    component.assistantPanelOpen.set(true);
    storeMock.assistantMessages.set([assistantPanelMessage]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const transcript = fixture.nativeElement.querySelector(
      '[data-speaking-selection-context="assistant-panel"][data-speaking-assistant-message-id="panel-assistant-1"]',
    ) as HTMLElement | null;
    expect(transcript).toBeTruthy();

    mockWindowSelection({
      anchorNode: transcript?.firstChild ?? transcript!,
      text: 'repeat this',
      rect: new DOMRect(80, 220, 110, 20),
    });

    component.onDocumentSelectionChange();

    expect(component.selectionTranslateTarget()).toEqual({
      context: 'assistant-panel',
      messageId: 'panel-assistant-1',
      selectedText: 'repeat this',
    });
    expect(component.selectionActionLabel()).toBe('發音');
  });

  it('AI 助手面板 user 訊息選取文字時不應顯示發音按鈕', async () => {
    const assistantPanelUserMessage: SpeakingAssistantMessage = {
      id: 'panel-user-1',
      role: 'user',
      content: 'Can you help me?',
      createdAt: '2026-02-22T10:11:00.000Z',
    };

    component.assistantPanelOpen.set(true);
    storeMock.assistantMessages.set([assistantPanelUserMessage]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const userBubble = fixture.nativeElement.querySelector('.bg-primary') as HTMLElement | null;
    expect(userBubble).toBeTruthy();

    mockWindowSelection({
      anchorNode: userBubble?.firstChild ?? userBubble!,
      text: 'help',
      rect: new DOMRect(96, 196, 74, 20),
    });

    component.onDocumentSelectionChange();

    expect(component.selectionActionVisible()).toBe(false);
    expect(component.selectionTranslateTarget()).toBeNull();
  });

  it('非 assistant 區域選取文字時不應顯示翻譯按鈕', () => {
    fixture.detectChanges();

    const externalNode = document.createElement('p');
    externalNode.textContent = 'outside selection';
    document.body.appendChild(externalNode);

    mockWindowSelection({
      anchorNode: externalNode.firstChild ?? externalNode,
      text: 'outside',
      rect: new DOMRect(96, 196, 74, 20),
    });

    component.onDocumentSelectionChange();

    expect(component.selectionActionVisible()).toBe(false);
    expect(component.selectionTranslateTarget()).toBeNull();
  });

  it('既有整則訊息翻譯切換仍可正常運作', async () => {
    const assistantMessage: SpeakingMessage = {
      id: 'assistant-translate',
      conversationId: 'conversation-1',
      role: 'assistant',
      text: 'How is your day?',
      translatedText: '你今天過得如何？',
      createdAt: '2026-02-22T10:20:00.000Z',
    };

    storeMock.messages.set([assistantMessage]);
    fixture.detectChanges();

    expect(component.shouldShowTranslation(assistantMessage)).toBe(false);

    await component.onToggleTranslate(assistantMessage);
    expect(component.shouldShowTranslation(assistantMessage)).toBe(true);

    await component.onToggleTranslate(assistantMessage);
    expect(component.shouldShowTranslation(assistantMessage)).toBe(false);
    expect(storeMock.translateMessage).not.toHaveBeenCalled();
  });

  it('assistant 輸入框按 Enter 應保留換行，不直接送出', () => {
    component.assistantInputControl.setValue('Hello');

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      cancelable: true,
    });

    component.onAssistantInputKeydown(event);

    expect(event.defaultPrevented).toBe(false);
    expect(storeMock.sendAssistantMessage).not.toHaveBeenCalled();
    expect(component.assistantInputControl.value).toBe('Hello');
  });

  it('assistant 輸入框按 Ctrl/Cmd + Enter 應送出訊息', () => {
    component.assistantInputControl.setValue('  Hello  ');

    const ctrlEnterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      cancelable: true,
    });

    component.onAssistantInputKeydown(ctrlEnterEvent);

    expect(ctrlEnterEvent.defaultPrevented).toBe(true);
    expect(storeMock.sendAssistantMessage).toHaveBeenCalledWith('Hello');
    expect(component.assistantInputControl.value).toBe('');
  });

  it('AI 助手面板選取發音時不應顯示 tooltip，按鈕應走 loading 與播放狀態', async () => {
    const assistantPanelMessage: SpeakingAssistantMessage = {
      id: 'panel-assistant-2',
      role: 'assistant',
      content: 'Practice this sentence please.',
      createdAt: '2026-02-22T10:30:00.000Z',
    };

    let resolvePlay: (() => void) | null = null;
    ttsStoreMock.play.mockImplementationOnce(
      (text: string) =>
        new Promise<void>((resolve) => {
          const trimmed = text.trim();
          ttsStoreMock.loadingText.set(trimmed);
          resolvePlay = () => {
            ttsStoreMock.loadingText.set(null);
            ttsStoreMock.playingText.set(trimmed);
            ttsStoreMock.playingText.set(null);
            ttsStoreMock.error.set(null);
            resolve();
          };
        }),
    );

    component.assistantPanelOpen.set(true);
    storeMock.assistantMessages.set([assistantPanelMessage]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const transcript = fixture.nativeElement.querySelector(
      '[data-speaking-selection-context="assistant-panel"][data-speaking-assistant-message-id="panel-assistant-2"]',
    ) as HTMLElement | null;
    expect(transcript).toBeTruthy();

    mockWindowSelection({
      anchorNode: transcript?.firstChild ?? transcript!,
      text: 'Practice this',
      rect: new DOMRect(140, 260, 120, 20),
    });

    component.onDocumentSelectionChange();
    const actionPromise = component.onSelectionTranslateActionClick();

    expect(component.shouldShowSelectionTooltip()).toBe(false);
    expect(component.isSelectionPronunciationLoading()).toBe(true);
    expect(component.selectionActionLabel()).toBe('發音');

    if (typeof resolvePlay === 'function') {
      (resolvePlay as () => void)();
    }
    await actionPromise;

    expect(ttsStoreMock.clearError).toHaveBeenCalled();
    expect(ttsStoreMock.play).toHaveBeenCalledWith('Practice this');
    expect(component.isSelectionPronunciationLoading()).toBe(false);
    expect(component.isSelectionPronunciationReady()).toBe(true);
    expect(component.selectionActionLabel()).toBe('播放');
  });

  it('AI 助手面板選取發音失敗時按鈕可重試', async () => {
    const assistantPanelMessage: SpeakingAssistantMessage = {
      id: 'panel-assistant-3',
      role: 'assistant',
      content: 'Listen to this phrase.',
      createdAt: '2026-02-22T10:40:00.000Z',
    };

    ttsStoreMock.play
      .mockImplementationOnce(async () => {
        ttsStoreMock.loadingText.set(null);
        ttsStoreMock.playingText.set(null);
        ttsStoreMock.error.set('語音播放失敗');
      })
      .mockImplementationOnce(async () => {
        ttsStoreMock.loadingText.set(null);
        ttsStoreMock.playingText.set(null);
        ttsStoreMock.error.set(null);
      });

    component.assistantPanelOpen.set(true);
    storeMock.assistantMessages.set([assistantPanelMessage]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const transcript = fixture.nativeElement.querySelector(
      '[data-speaking-selection-context="assistant-panel"][data-speaking-assistant-message-id="panel-assistant-3"]',
    ) as HTMLElement | null;
    expect(transcript).toBeTruthy();

    mockWindowSelection({
      anchorNode: transcript?.firstChild ?? transcript!,
      text: 'this phrase',
      rect: new DOMRect(120, 250, 96, 20),
    });

    component.onDocumentSelectionChange();

    await component.onSelectionTranslateActionClick();
    expect(component.shouldShowSelectionTooltip()).toBe(false);
    expect(component.isSelectionPronunciationReady()).toBe(false);
    expect(component.selectionActionLabel()).toBe('發音');

    await component.onSelectionTranslateRetry();
    expect(ttsStoreMock.play).toHaveBeenCalledTimes(2);
    expect(component.isSelectionPronunciationReady()).toBe(true);
    expect(component.selectionActionLabel()).toBe('播放');
  });

  it('選取變更後舊的發音結果不得覆蓋新的狀態', async () => {
    const assistantPanelMessage: SpeakingAssistantMessage = {
      id: 'panel-assistant-4',
      role: 'assistant',
      content: 'Practice pronunciation with confidence.',
      createdAt: '2026-02-22T10:50:00.000Z',
    };

    let resolveFirstPlay: (() => void) | null = null;
    ttsStoreMock.play
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirstPlay = () => {
              ttsStoreMock.loadingText.set(null);
              ttsStoreMock.playingText.set(null);
              ttsStoreMock.error.set('語音播放失敗');
              resolve();
            };
          }),
      )
      .mockImplementationOnce(async () => {
        ttsStoreMock.loadingText.set(null);
        ttsStoreMock.playingText.set(null);
        ttsStoreMock.error.set(null);
      });

    component.assistantPanelOpen.set(true);
    storeMock.assistantMessages.set([assistantPanelMessage]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const transcript = fixture.nativeElement.querySelector(
      '[data-speaking-selection-context="assistant-panel"][data-speaking-assistant-message-id="panel-assistant-4"]',
    ) as HTMLElement | null;
    expect(transcript).toBeTruthy();

    mockWindowSelection({
      anchorNode: transcript?.firstChild ?? transcript!,
      text: 'Practice pronunciation',
      rect: new DOMRect(120, 250, 150, 20),
    });
    component.onDocumentSelectionChange();
    const firstAction = component.onSelectionTranslateActionClick();

    mockWindowSelection({
      anchorNode: transcript?.firstChild ?? transcript!,
      text: 'with confidence',
      rect: new DOMRect(120, 276, 120, 20),
    });
    component.onDocumentSelectionChange();
    await component.onSelectionTranslateActionClick();

    if (typeof resolveFirstPlay === 'function') {
      (resolveFirstPlay as () => void)();
    }
    await firstAction;

    expect(component.selectionTranslateTarget()).toEqual({
      context: 'assistant-panel',
      messageId: 'panel-assistant-4',
      selectedText: 'with confidence',
    });
    expect(component.isSelectionPronunciationReady()).toBe(true);
    expect(component.selectionActionLabel()).toBe('播放');
  });

  it('發音選取在視窗滾動時應關閉 tooltip', async () => {
    const assistantPanelMessage: SpeakingAssistantMessage = {
      id: 'panel-assistant-5',
      role: 'assistant',
      content: 'Close tooltip on scroll.',
      createdAt: '2026-02-22T11:00:00.000Z',
    };

    component.assistantPanelOpen.set(true);
    storeMock.assistantMessages.set([assistantPanelMessage]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const transcript = fixture.nativeElement.querySelector(
      '[data-speaking-selection-context="assistant-panel"][data-speaking-assistant-message-id="panel-assistant-5"]',
    ) as HTMLElement | null;
    expect(transcript).toBeTruthy();

    mockWindowSelection({
      anchorNode: transcript?.firstChild ?? transcript!,
      text: 'tooltip',
      rect: new DOMRect(128, 264, 80, 20),
    });
    component.onDocumentSelectionChange();
    expect(component.selectionActionVisible()).toBe(true);

    component.onWindowScroll();
    expect(component.selectionTranslateTarget()).toBeNull();
    expect(component.selectionTooltipVisible()).toBe(false);
  });
});

function createSpeakingStoreMock() {
  return {
    speakingSettings: signal({
      ...SPEAKING_DEFAULT_SETTINGS,
      showTranscript: true,
    }),
    messages: signal<SpeakingMessage[]>([]),
    sending: signal(false),
    summarizing: signal(false),
    translatingMessageId: signal<string | null>(null),
    loadingConversation: signal(false),
    retryAvailable: signal(false),
    assistantMessages: signal<SpeakingAssistantMessage[]>([]),
    assistantSending: signal(false),
    error: signal<string | null>(null),
    conversationId: signal('conversation-1'),
    playingAudioKey: signal<string | null>(null),
    refreshSpeakingSettings: vi.fn(),
    startNewConversation: vi.fn(async () => undefined),
    loadConversation: vi.fn(async () => true),
    sendAudioMessage: vi.fn(async () => undefined),
    retryLastAudio: vi.fn(async () => undefined),
    playMessageAudio: vi.fn(async () => undefined),
    translateMessage: vi.fn(async () => undefined),
    summarizeCurrentConversation: vi.fn(async () => undefined),
    sendAssistantMessage: vi.fn(async () => undefined),
    clearAssistantMessages: vi.fn(),
    hydrateAssistantMessages: vi.fn(),
    clearError: vi.fn(),
    translateSelectedText: vi.fn(async ({ requestToken }: { requestToken: number }) => ({
      status: 'success' as const,
      requestToken,
      translatedText: '你好',
      cached: false,
    })),
  };
}

function createTtsStoreMock() {
  const error = signal<string | null>(null);
  const loadingText = signal<string | null>(null);
  const playingText = signal<string | null>(null);

  return {
    error,
    loadingText,
    playingText,
    clearError: vi.fn(() => {
      error.set(null);
    }),
    play: vi.fn(async (text: string) => {
      const trimmed = text.trim();
      loadingText.set(trimmed);
      loadingText.set(null);
      playingText.set(trimmed);
      playingText.set(null);
      error.set(null);
    }),
  };
}

function createRecorderMock() {
  return {
    status: signal<'idle' | 'recording' | 'paused' | 'unsupported' | 'denied'>('idle'),
    durationMs: signal(0),
    recordedBlob: signal<Blob | null>(null),
    error: signal<string | null>(null),
    start: vi.fn(async () => undefined),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(async () => null),
    cancel: vi.fn(),
    clearError: vi.fn(),
  };
}

function mockWindowSelection(input: {
  anchorNode: Node;
  text: string;
  rect?: DOMRect;
  isCollapsed?: boolean;
}): void {
  const range = {
    getBoundingClientRect: () => input.rect ?? new DOMRect(100, 200, 80, 20),
  } as Range;

  const selection = {
    rangeCount: input.isCollapsed ? 0 : 1,
    isCollapsed: input.isCollapsed ?? false,
    anchorNode: input.anchorNode,
    focusNode: input.anchorNode,
    toString: () => input.text,
    getRangeAt: () => range,
    removeAllRanges: vi.fn(),
  } as unknown as Selection;

  vi.spyOn(window, 'getSelection').mockReturnValue(selection);
}
