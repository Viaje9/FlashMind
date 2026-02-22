import '@angular/compiler';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeakingRecorderService } from '../../components/speaking/speaking-recorder.service';
import {
  SPEAKING_DEFAULT_SETTINGS,
  type SpeakingMessage,
} from '../../components/speaking/speaking.domain';
import { SpeakingStore } from '../../components/speaking/speaking.store';
import { SpeakingComponent } from './speaking.component';

describe('speaking.component selection translate', () => {
  let fixture: ComponentFixture<SpeakingComponent>;
  let component: SpeakingComponent;
  let storeMock: ReturnType<typeof createSpeakingStoreMock>;

  beforeEach(async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
    });

    storeMock = createSpeakingStoreMock();

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
    assistantMessages: signal([]),
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
