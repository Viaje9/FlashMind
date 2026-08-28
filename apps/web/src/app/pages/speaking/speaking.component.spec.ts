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

  it('應分別使用 Realtime 2.1 mini 與 Luna 價格估算語音及摘要花費', () => {
    storeMock.messages.set([
      {
        id: 'assistant-cost',
        conversationId: 'conversation-1',
        role: 'assistant',
        createdAt: '2026-08-26T01:00:00.000Z',
        usage: {
          promptTokens: 2_000_000,
          completionTokens: 2_000_000,
          totalTokens: 4_000_000,
          promptTextTokens: 1_000_000,
          promptAudioTokens: 1_000_000,
          completionTextTokens: 1_000_000,
          completionAudioTokens: 1_000_000,
        },
      },
      {
        id: 'summary-cost',
        conversationId: 'conversation-1',
        role: 'summary',
        createdAt: '2026-08-26T01:01:00.000Z',
        usage: {
          promptTokens: 1_000_000,
          completionTokens: 1_000_000,
          totalTokens: 2_000_000,
          promptTextTokens: 1_000_000,
          promptAudioTokens: 0,
          completionTextTokens: 1_000_000,
          completionAudioTokens: 0,
        },
      },
    ]);

    expect(component.spending().totalCostTwd).toBeCloseTo(1126.4);
    expect(component.spending().lastRequestCostTwd).toBeCloseTo(70.4);
  });

  it('目標單字連結應保留目前 Speaking 對話來源', () => {
    storeMock.conversationId.set('conversation-1');
    storeMock.messages.set([
      {
        id: 'user-1',
        conversationId: 'conversation-1',
        role: 'user',
        text: 'Hello.',
        createdAt: '2026-08-26T01:00:00.000Z',
      },
    ]);
    expect(component.targetVocabularyQueryParams()).toEqual({
      from: 'speaking',
      conversationId: 'conversation-1',
    });

    storeMock.messages.set([]);
    expect(component.targetVocabularyQueryParams()).toEqual({ from: 'speaking' });
  });

  it('停止錄音並等待即時回覆播放時不應持續靜音', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    storeMock.setAudioPlaybackMuted.mockClear();

    storeMock.sending.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(storeMock.setAudioPlaybackMuted).toHaveBeenLastCalledWith(true);

    component.stoppingAndSending.set(true);
    storeMock.sending.set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(storeMock.setAudioPlaybackMuted).toHaveBeenLastCalledWith(false);
  });

  it('真即時模式應啟動持續串流，停止時結束連線', async () => {
    storeMock.speakingSettings.set({
      ...SPEAKING_DEFAULT_SETTINGS,
      interactionMode: 'FULL_DUPLEX',
    });

    await component.onStartRecording();

    expect(storeMock.startFullDuplexConversation).toHaveBeenCalledTimes(1);
    expect(component.realtimeConversationActive()).toBe(true);

    fixture.detectChanges();
    const aiMuteButton = fixture.nativeElement.querySelector(
      '[data-testid="speaking-full-duplex-ai-mute"]',
    ) as HTMLButtonElement | null;
    const myMuteButton = fixture.nativeElement.querySelector(
      '[data-testid="speaking-full-duplex-my-mute"]',
    ) as HTMLButtonElement | null;
    expect(aiMuteButton?.getAttribute('aria-label')).toBe('將 AI 聲音靜音');
    expect(myMuteButton?.getAttribute('aria-label')).toBe('將我的聲音靜音');

    aiMuteButton?.click();
    myMuteButton?.click();
    expect(storeMock.toggleFullDuplexOutputMuted).toHaveBeenCalledTimes(1);
    expect(storeMock.toggleFullDuplexInputMuted).toHaveBeenCalledTimes(1);

    await component.onStopRecording();

    expect(storeMock.stopFullDuplexConversation).toHaveBeenCalled();
    expect(storeMock.disconnectRealtimeSession).toHaveBeenCalled();
    expect(component.realtimeConversationActive()).toBe(false);
  });

  it('使用者語音逐字稿應預設收合，並可獨立展開與收起', async () => {
    storeMock.messages.set([
      {
        id: 'user-transcript-1',
        conversationId: 'conversation-1',
        role: 'user',
        text: 'I practiced speaking today.',
        audioBlobKey: 'user-transcript-1:audio',
        createdAt: '2026-08-26T01:00:00.000Z',
      },
    ]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const toggle = fixture.nativeElement.querySelector(
      '[data-testid="speaking-user-transcript-toggle-user-transcript-1"]',
    ) as HTMLButtonElement | null;

    expect(toggle).toBeTruthy();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="speaking-user-transcript-user-transcript-1"]',
      ),
    ).toBeNull();

    toggle?.click();
    fixture.detectChanges();

    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="speaking-user-transcript-user-transcript-1"]',
      )?.textContent,
    ).toContain('I practiced speaking today.');

    toggle?.click();
    fixture.detectChanges();

    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="speaking-user-transcript-user-transcript-1"]',
      ),
    ).toBeNull();
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

  it('已有對話整理後應隱藏語音輸入與整理按鈕', async () => {
    const messages: SpeakingMessage[] = [
      {
        id: 'user-1',
        conversationId: 'conversation-1',
        role: 'user',
        text: 'I went jogging.',
        createdAt: '2026-02-22T11:10:00.000Z',
      },
      {
        id: 'summary-1',
        conversationId: 'conversation-1',
        role: 'summary',
        text: 'I went jogging and worked in the afternoon.',
        createdAt: '2026-02-22T11:11:00.000Z',
      },
    ];

    storeMock.messages.set(messages);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const micButton = fixture.nativeElement.querySelector(
      '[data-testid="speaking-mic-main"]',
    ) as HTMLButtonElement | null;
    const summarizeButton = fixture.nativeElement.querySelector(
      '[aria-label="整理對話"]',
    ) as HTMLButtonElement | null;

    expect(micButton).toBeNull();
    expect(summarizeButton).toBeNull();
  });

  it('對話整理卡片右上角按鈕可複製摘要', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    const summaryMessage: SpeakingMessage = {
      id: 'summary-copy-1',
      conversationId: 'conversation-1',
      role: 'summary',
      text: 'I practiced ordering food and talked about my weekend plan.',
      createdAt: '2026-02-22T11:20:00.000Z',
    };

    storeMock.messages.set([summaryMessage]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const copyButton = fixture.nativeElement.querySelector(
      '[data-testid="speaking-summary-copy"]',
    ) as HTMLButtonElement | null;
    expect(copyButton).toBeTruthy();
    expect(copyButton?.classList.contains('text-orange-600')).toBe(true);
    expect(copyButton?.classList.contains('text-emerald-600')).toBe(false);

    copyButton?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(writeText).toHaveBeenCalledWith(summaryMessage.text);
    expect(copyButton?.classList.contains('text-orange-600')).toBe(false);
    expect(copyButton?.classList.contains('text-emerald-600')).toBe(true);
    expect(copyButton?.getAttribute('aria-label')).toBe('摘要已複製');
  });

  it('對話整理應將摘要、回顧、單字與下次主題分區呈現', async () => {
    storeMock.messages.set([
      {
        id: 'summary-sections-1',
        conversationId: 'conversation-1',
        role: 'summary',
        text: `I explained my learning plan.

練習回顧
你有清楚說明自己的目標。

這次實際使用
• practice（練習）

下次可以試試
• confidence（信心）

下次主題
My English-learning website`,
        createdAt: '2026-02-22T11:20:00.000Z',
      },
    ]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="speaking-summary-main"]')?.textContent,
    ).toContain('I explained my learning plan.');
    expect(
      fixture.nativeElement.querySelector('[data-testid="speaking-summary-review"]')?.textContent,
    ).toContain('你有清楚說明自己的目標。');
    expect(
      fixture.nativeElement.querySelector('[data-testid="speaking-summary-actual-uses"]')
        ?.textContent,
    ).toContain('practice（練習）');
    expect(
      fixture.nativeElement.querySelector('[data-testid="speaking-summary-recommendations"]')
        ?.textContent,
    ).toContain('confidence（信心）');
    expect(
      fixture.nativeElement.querySelector('[data-testid="speaking-summary-next-topic"]')
        ?.textContent,
    ).toContain('My English-learning website');
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
    conversationId: signal<string | null>('conversation-1'),
    playingAudioKey: signal<string | null>(null),
    fullDuplexInputMuted: signal(false),
    fullDuplexOutputMuted: signal(false),
    refreshSpeakingSettings: vi.fn(),
    activateSharedAudioTrack: vi.fn(async () => undefined),
    prepareRealtimeSession: vi.fn(async () => undefined),
    disconnectRealtimeSession: vi.fn(),
    startFullDuplexConversation: vi.fn(async () => undefined),
    stopFullDuplexConversation: vi.fn(),
    toggleFullDuplexInputMuted: vi.fn(),
    toggleFullDuplexOutputMuted: vi.fn(),
    deactivateSharedAudioTrack: vi.fn(),
    setAudioPlaybackMuted: vi.fn(),
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
