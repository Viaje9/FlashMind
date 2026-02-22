import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FmButtonComponent, FmIconButtonComponent, FmPageHeaderComponent } from '@flashmind/ui';
import { SpeakingRecorderService } from '../../components/speaking/speaking-recorder.service';
import { SpeakingStore } from '../../components/speaking/speaking.store';
import { TtsStore } from '../../components/tts/tts.store';
import {
  type SpeakingAssistantMessage,
  type SpeakingMessage,
  isSelectionTranslationResultStale,
} from '../../components/speaking/speaking.domain';

interface DragState {
  active: boolean;
  pointerId: number;
  offsetY: number;
}

interface ResizeState {
  active: boolean;
  pointerId: number;
  startHeight: number;
  startClientY: number;
}

interface SelectionTranslateTarget {
  context: SelectionContext;
  messageId: string;
  selectedText: string;
}

interface SelectionOverlayPosition {
  left: number;
  top: number;
}

type SelectionTooltipStatus = 'idle' | 'loading' | 'playing' | 'success' | 'error';

type SelectionContext = 'main-transcript' | 'assistant-panel';

interface CustomSelectionState {
  context: SelectionContext;
  messageId: string;
  startTokenIndex: number;
  endTokenIndex: number;
}

interface CustomSelectionDragState {
  active: boolean;
  pointerId: number;
  context: SelectionContext | null;
  messageId: string | null;
}

const NOTE_PANEL_SIDE_GAP = 12;
const NOTE_PANEL_INITIAL_HEIGHT = 320;
const NOTE_PANEL_MIN_HEIGHT = 220;
const NOTE_PANEL_SAFE_BOTTOM = 136;
const NOTE_PANEL_MARGIN = 12;
const NOTE_STORAGE_KEY = 'flashmind.speaking.note.text';
const NOTE_HEIGHT_KEY = 'flashmind.speaking.note.height';

const ASSISTANT_PANEL_SIDE_GAP = 12;
const ASSISTANT_PANEL_INITIAL_HEIGHT = 380;
const ASSISTANT_PANEL_MIN_HEIGHT = 260;
const ASSISTANT_PANEL_SAFE_BOTTOM = 12;
const ASSISTANT_PANEL_MARGIN = 12;
const ASSISTANT_MESSAGES_STORAGE_KEY = 'flashmind.speaking.assistant.messages';
const ASSISTANT_TOP_STORAGE_KEY = 'flashmind.speaking.assistant.top';
const ASSISTANT_HEIGHT_STORAGE_KEY = 'flashmind.speaking.assistant.height';
const USD_TO_TWD = 32;
const AUDIO_MODEL_TEXT_INPUT_USD_PER_MILLION = 0.15;
const AUDIO_MODEL_TEXT_OUTPUT_USD_PER_MILLION = 0.6;
const AUDIO_MODEL_AUDIO_INPUT_USD_PER_MILLION = 10;
const AUDIO_MODEL_AUDIO_OUTPUT_USD_PER_MILLION = 20;
const SELECTION_ACTION_WIDTH = 64;
const SELECTION_ACTION_HEIGHT = 36;
const SELECTION_OVERLAY_GAP = 10;
const SELECTION_OVERLAY_SAFE_MARGIN = 8;
const MAIN_TRANSCRIPT_CONTEXT: SelectionContext = 'main-transcript';
const ASSISTANT_PANEL_CONTEXT: SelectionContext = 'assistant-panel';

@Component({
  selector: 'app-speaking-page',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    FmPageHeaderComponent,
    FmIconButtonComponent,
    FmButtonComponent,
  ],
  templateUrl: './speaking.component.html',
  styleUrl: './speaking.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpeakingComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly speakingStore = inject(SpeakingStore);
  readonly recorder = inject(SpeakingRecorderService);
  private readonly ttsStore = inject(TtsStore);

  @ViewChild('notePanelRef') private notePanelRef?: ElementRef<HTMLDivElement>;
  @ViewChild('assistantPanelRef') private assistantPanelRef?: ElementRef<HTMLDivElement>;
  @ViewChild('assistantMessagesRef') private assistantMessagesRef?: ElementRef<HTMLDivElement>;

  readonly settings = this.speakingStore.speakingSettings;
  readonly messages = this.speakingStore.messages;
  readonly sending = this.speakingStore.sending;
  readonly summarizing = this.speakingStore.summarizing;
  readonly translatingMessageId = this.speakingStore.translatingMessageId;
  readonly loadingConversation = this.speakingStore.loadingConversation;
  readonly retryAvailable = this.speakingStore.retryAvailable;

  readonly assistantMessages = this.speakingStore.assistantMessages;
  readonly assistantSending = this.speakingStore.assistantSending;

  readonly assistantInputControl = new FormControl('', { nonNullable: true });
  readonly assistantPanelOpen = signal(false);
  readonly assistantPanelTop = signal(this.loadAssistantPanelTop());
  readonly assistantPanelHeight = signal(this.loadAssistantPanelHeight());
  readonly translationVisibleIds = signal<Set<string>>(new Set());
  readonly selectionTranslateTarget = signal<SelectionTranslateTarget | null>(null);
  readonly selectionActionPosition = signal<SelectionOverlayPosition>({ left: 0, top: 0 });
  readonly selectionTooltipStatus = signal<SelectionTooltipStatus>('idle');
  readonly selectionTooltipVisible = signal(false);
  readonly selectionTooltipText = signal('');
  readonly selectionTooltipError = signal<string | null>(null);
  readonly isIosStandalonePwa = this.detectIosStandalonePwa();
  readonly useCustomSelectionMode = computed(() => this.isIosStandalonePwa);
  readonly customSelection = signal<CustomSelectionState | null>(null);
  readonly selectionActionVisible = computed(() => !!this.selectionTranslateTarget()?.selectedText);

  readonly notePanelOpen = signal(false);
  readonly noteText = signal(this.loadNoteText());
  readonly notePanelHeight = signal(this.loadNotePanelHeight());
  readonly notePanelTop = signal(this.initialNotePanelTop());
  readonly noteEditing = signal(false);
  readonly stoppingAndSending = signal(false);
  readonly copiedSummaryMessageId = signal<string | null>(null);

  readonly canSummarize = computed(
    () =>
      this.messages().length > 0 &&
      !this.hasConversationSummary() &&
      !this.summarizing() &&
      !this.sending() &&
      !this.loadingConversation(),
  );

  readonly hasUserMessages = computed(() =>
    this.messages().some((message) => message.role === 'user'),
  );
  readonly hasConversationSummary = computed(() =>
    this.messages().some((message) => message.role === 'summary' && !!message.text?.trim()),
  );
  readonly canShowSummarizeAction = computed(
    () => this.hasUserMessages() && !this.hasConversationSummary(),
  );

  readonly recorderStatus = this.recorder.status;
  readonly recorderDurationMs = this.recorder.durationMs;
  readonly recorderBlob = this.recorder.recordedBlob;
  readonly recorderError = this.recorder.error;
  readonly isRecorderActive = computed(() => {
    const status = this.recorderStatus();
    return status === 'recording' || status === 'paused';
  });

  readonly unsupportedReason = computed(() => {
    if (!this.isSecureContext()) {
      return '目前不是 HTTPS 環境，瀏覽器會封鎖麥克風。';
    }
    if (this.recorderStatus() === 'unsupported') {
      return '此裝置或瀏覽器不支援 MediaRecorder。';
    }
    return null;
  });

  readonly permissionWarning = computed(() =>
    this.recorderStatus() === 'denied' ? '麥克風權限被拒絕，請到瀏覽器設定允許後再試一次。' : null,
  );

  readonly inputBlocked = computed(() => !!this.unsupportedReason());

  readonly combinedError = computed(() => this.speakingStore.error() ?? this.recorderError());
  readonly interactionLocked = computed(
    () => this.sending() || this.summarizing() || this.stoppingAndSending(),
  );
  readonly sendingStatusText = computed(() => {
    if (this.sending()) {
      return '正在送出語音到 API...';
    }

    if (this.stoppingAndSending()) {
      return '正在整理錄音...';
    }

    return null;
  });
  readonly spending = computed(() => {
    let totalCostTwd = 0;
    let lastRequestCostTwd = 0;

    for (const message of this.messages()) {
      const costUsd = this.calculateUsageCostUsd(message.usage);
      if (costUsd <= 0) {
        continue;
      }

      const costTwd = costUsd * USD_TO_TWD;
      totalCostTwd += costTwd;
      lastRequestCostTwd = costTwd;
    }

    return {
      totalCostTwd,
      lastRequestCostTwd,
    };
  });

  private noteDragState: DragState = {
    active: false,
    pointerId: -1,
    offsetY: 0,
  };

  private noteResizeState: ResizeState = {
    active: false,
    pointerId: -1,
    startHeight: NOTE_PANEL_INITIAL_HEIGHT,
    startClientY: 0,
  };

  private assistantDragState: DragState = {
    active: false,
    pointerId: -1,
    offsetY: 0,
  };

  private assistantResizeState: ResizeState = {
    active: false,
    pointerId: -1,
    startHeight: ASSISTANT_PANEL_INITIAL_HEIGHT,
    startClientY: 0,
  };
  private customSelectionDragState: CustomSelectionDragState = {
    active: false,
    pointerId: -1,
    context: null,
    messageId: null,
  };
  private readonly transcriptTokenCache = new Map<string, string[]>();
  private readonly pronunciationReadyKeys = signal<Set<string>>(new Set());
  private safeAreaInsetTop = 0;
  private safeAreaInsetMeasured = false;
  private selectionRequestToken = 0;
  private copySummaryResetTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      this.messages();
      this.scrollSpeakingMessagesToBottom();
    });

    effect(() => {
      const messages = this.assistantMessages();
      this.saveAssistantMessages(messages);
      this.scrollAssistantMessagesToBottom();
    });

    effect(() => {
      const target = this.selectionTranslateTarget();
      if (!this.settings().showTranscript && target?.context === MAIN_TRANSCRIPT_CONTEXT) {
        this.dismissSelectionTranslateUi(true);
      }
    });

    effect(() => {
      const status = this.recorderStatus();
      const muted =
        status === 'recording' ||
        status === 'paused' ||
        this.sending() ||
        this.stoppingAndSending();
      this.speakingStore.setAudioPlaybackMuted(muted);
    });
  }

  ngOnInit(): void {
    this.speakingStore.refreshSpeakingSettings();
    this.restoreAssistantMessages();

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const conversationId = params.get('conversationId');
      if (conversationId) {
        void this.tryLoadConversation(conversationId);
        return;
      }

      if (!this.speakingStore.conversationId()) {
        void this.speakingStore.startNewConversation();
      }
    });

    this.clampNotePanelBounds();
    this.clampAssistantPanelBounds();
  }

  ngOnDestroy(): void {
    if (this.copySummaryResetTimer) {
      clearTimeout(this.copySummaryResetTimer);
      this.copySummaryResetTimer = null;
    }
    this.speakingStore.deactivateSharedAudioTrack();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.safeAreaInsetMeasured = false;
    this.clampNotePanelBounds();
    this.clampAssistantPanelBounds();
    this.repositionSelectionOverlays();
  }

  @HostListener('window:blur')
  onWindowBlur(): void {
    this.dismissSelectionTranslateUi(true);
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.dismissSelectionTranslateUi(false);
  }

  @HostListener('document:selectionchange')
  onDocumentSelectionChange(): void {
    if (this.useCustomSelectionMode() || typeof window === 'undefined') {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      this.dismissSelectionTranslateUi(false);
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      this.dismissSelectionTranslateUi(false);
      return;
    }

    const selectionHost = this.resolveAssistantSelectionHost(
      selection.anchorNode,
      selection.focusNode,
    );
    if (!selectionHost) {
      this.dismissSelectionTranslateUi(false);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0) {
      return;
    }

    const messageId = selectionHost.dataset['speakingAssistantMessageId'];
    const context = this.resolveSelectionContextFromHost(selectionHost);
    if (!messageId || !context) {
      this.dismissSelectionTranslateUi(false);
      return;
    }

    this.applySelectionTarget(context, messageId, selectedText, rect);
  }

  @HostListener('document:pointerup', ['$event'])
  onDocumentPointerUp(event: PointerEvent): void {
    if (
      !this.customSelectionDragState.active ||
      this.customSelectionDragState.pointerId !== event.pointerId
    ) {
      return;
    }

    const draggingMessageId = this.customSelectionDragState.messageId;
    const draggingContext = this.customSelectionDragState.context;
    if (draggingMessageId && draggingContext) {
      this.finalizeCustomSelection(draggingContext, draggingMessageId);
    }

    this.endCustomSelectionDrag();
  }

  @HostListener('document:pointercancel', ['$event'])
  onDocumentPointerCancel(event: PointerEvent): void {
    if (this.customSelectionDragState.pointerId !== event.pointerId) {
      return;
    }

    this.endCustomSelectionDrag();
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    if (target.closest('[data-speaking-selection-overlay="true"]')) {
      return;
    }

    if (target.closest('[data-speaking-assistant-message-id]')) {
      return;
    }

    this.dismissSelectionTranslateUi(false);
  }

  async onHeaderTitleClick(): Promise<void> {
    await this.router.navigate(['/home']);
  }

  async onStartNewConversation(): Promise<void> {
    this.dismissSelectionTranslateUi(true);
    this.recorder.cancel();
    await this.speakingStore.startNewConversation();
    await this.router.navigate(['/speaking']);
  }

  async onStartRecording(): Promise<void> {
    if (this.hasConversationSummary()) {
      return;
    }

    await this.speakingStore.activateSharedAudioTrack();
    await this.recorder.start();
  }

  onPauseRecording(): void {
    this.recorder.pause();
  }

  onResumeRecording(): void {
    this.recorder.resume();
  }

  async onStopRecording(): Promise<void> {
    if (this.stoppingAndSending() || this.sending()) {
      return;
    }

    this.stoppingAndSending.set(true);

    try {
      const blob = await this.recorder.stop();
      this.recorder.cancel();

      if (!blob || blob.size === 0) {
        return;
      }

      await this.speakingStore.sendAudioMessage(blob);
    } finally {
      if (this.recorderStatus() !== 'idle') {
        this.recorder.cancel();
      }
      this.stoppingAndSending.set(false);
    }
  }

  onCancelRecording(): void {
    if (this.stoppingAndSending()) {
      return;
    }
    this.recorder.cancel();
  }

  async onRetryLastRequest(): Promise<void> {
    await this.speakingStore.retryLastAudio();
  }

  async onPlayMessageAudio(messageId: string): Promise<void> {
    await this.speakingStore.playMessageAudio(messageId);
  }

  isMessagePlaying(message: SpeakingMessage): boolean {
    return !!message.audioBlobKey && this.speakingStore.playingAudioKey() === message.audioBlobKey;
  }

  async onToggleTranslate(message: SpeakingMessage): Promise<void> {
    if (!message.id) {
      return;
    }

    const next = new Set(this.translationVisibleIds());

    if (message.translatedText?.trim()) {
      if (next.has(message.id)) {
        next.delete(message.id);
      } else {
        next.add(message.id);
      }
      this.translationVisibleIds.set(next);
      return;
    }

    await this.speakingStore.translateMessage(message.id);

    const translatedMessage = this.messages().find((item) => item.id === message.id);
    if (translatedMessage?.translatedText?.trim()) {
      next.add(message.id);
      this.translationVisibleIds.set(next);
    }
  }

  shouldShowTranslation(message: SpeakingMessage): boolean {
    return !!message.translatedText?.trim() && this.translationVisibleIds().has(message.id);
  }

  getDisplayedTranscript(message: SpeakingMessage): string {
    if (this.shouldShowTranslation(message) && message.translatedText?.trim()) {
      return message.translatedText;
    }

    return message.text?.trim() ? message.text : '';
  }

  getTranscriptTokens(message: SpeakingMessage): string[] {
    const transcript = this.getDisplayedTranscript(message);
    if (!transcript) {
      return [];
    }

    return this.getTokensWithCache(`${MAIN_TRANSCRIPT_CONTEXT}:${message.id}`, transcript);
  }

  getAssistantMessageTokens(message: SpeakingAssistantMessage): string[] {
    const content = message.content?.trim();
    if (!content) {
      return [];
    }

    return this.getTokensWithCache(`${ASSISTANT_PANEL_CONTEXT}:${message.id}`, content);
  }

  isCustomTokenSelected(context: SelectionContext, messageId: string, tokenIndex: number): boolean {
    const selection = this.customSelection();
    if (!selection || selection.context !== context || selection.messageId !== messageId) {
      return false;
    }

    const [start, end] = this.normalizeTokenRange(
      selection.startTokenIndex,
      selection.endTokenIndex,
    );
    return tokenIndex >= start && tokenIndex <= end;
  }

  isWhitespaceToken(token: string): boolean {
    return token.trim().length === 0;
  }

  onCustomTranscriptPointerDown(message: SpeakingMessage, event: PointerEvent): void {
    this.onCustomSelectionPointerDown(MAIN_TRANSCRIPT_CONTEXT, message.id, event);
  }

  onCustomTranscriptPointerMove(message: SpeakingMessage, event: PointerEvent): void {
    this.onCustomSelectionPointerMove(MAIN_TRANSCRIPT_CONTEXT, message.id, event);
  }

  onCustomTranscriptPointerUp(message: SpeakingMessage, event: PointerEvent): void {
    this.onCustomSelectionPointerUp(MAIN_TRANSCRIPT_CONTEXT, message.id, event);
  }

  onCustomTranscriptPointerCancel(message: SpeakingMessage, event: PointerEvent): void {
    this.onCustomSelectionPointerCancel(MAIN_TRANSCRIPT_CONTEXT, message.id, event);
  }

  onAssistantPanelMessagePointerDown(message: SpeakingAssistantMessage, event: PointerEvent): void {
    if (message.role !== 'assistant') {
      return;
    }

    this.onCustomSelectionPointerDown(ASSISTANT_PANEL_CONTEXT, message.id, event);
  }

  onAssistantPanelMessagePointerMove(message: SpeakingAssistantMessage, event: PointerEvent): void {
    if (message.role !== 'assistant') {
      return;
    }

    this.onCustomSelectionPointerMove(ASSISTANT_PANEL_CONTEXT, message.id, event);
  }

  onAssistantPanelMessagePointerUp(message: SpeakingAssistantMessage, event: PointerEvent): void {
    if (message.role !== 'assistant') {
      return;
    }

    this.onCustomSelectionPointerUp(ASSISTANT_PANEL_CONTEXT, message.id, event);
  }

  onAssistantPanelMessagePointerCancel(
    message: SpeakingAssistantMessage,
    event: PointerEvent,
  ): void {
    if (message.role !== 'assistant') {
      return;
    }

    this.onCustomSelectionPointerCancel(ASSISTANT_PANEL_CONTEXT, message.id, event);
  }

  selectionActionLabel(): string {
    return this.isPronunciationTarget(this.selectionTranslateTarget())
      ? this.selectionPronunciationButtonText()
      : '翻譯';
  }

  selectionTooltipTitle(): string {
    return this.isPronunciationTarget(this.selectionTranslateTarget()) ? '片段發音' : '片段翻譯';
  }

  selectionTooltipLoadingLabel(): string {
    return '翻譯中';
  }

  shouldShowSelectionTooltip(): boolean {
    const target = this.selectionTranslateTarget();
    return !!target && !this.isPronunciationTarget(target) && this.selectionTooltipVisible();
  }

  isSelectionActionPronunciation(): boolean {
    return this.isPronunciationTarget(this.selectionTranslateTarget());
  }

  isSelectionPronunciationLoading(): boolean {
    const target = this.selectionTranslateTarget();
    if (!target || target.context !== ASSISTANT_PANEL_CONTEXT) {
      return false;
    }

    return this.ttsStore.loadingText() === target.selectedText;
  }

  isSelectionPronunciationPlaying(): boolean {
    const target = this.selectionTranslateTarget();
    if (!target || target.context !== ASSISTANT_PANEL_CONTEXT) {
      return false;
    }

    return this.ttsStore.playingText() === target.selectedText;
  }

  isSelectionPronunciationReady(): boolean {
    const target = this.selectionTranslateTarget();
    if (!target || target.context !== ASSISTANT_PANEL_CONTEXT) {
      return false;
    }

    return this.pronunciationReadyKeys().has(this.createPronunciationReadyKey(target));
  }

  shouldShowSelectionPronunciationIcon(): boolean {
    return this.isSelectionPronunciationPlaying() || this.isSelectionPronunciationReady();
  }

  selectionPronunciationButtonText(): string {
    if (!this.isSelectionActionPronunciation()) {
      return '翻譯';
    }

    if (this.isSelectionPronunciationPlaying()) {
      return '暫停';
    }

    if (this.isSelectionPronunciationReady()) {
      return '播放';
    }

    return '發音';
  }

  selectionActionZIndex(): number {
    return this.isPronunciationTarget(this.selectionTranslateTarget()) ? 90 : 70;
  }

  selectionTooltipBackdropZIndex(): number {
    return this.isPronunciationTarget(this.selectionTranslateTarget()) ? 92 : 72;
  }

  async onSelectionTranslateActionClick(): Promise<void> {
    const target = this.selectionTranslateTarget();
    if (!target) {
      return;
    }

    if (this.isPronunciationTarget(target)) {
      await this.onSelectionPronunciationActionClick(target);
      return;
    }

    await this.onSelectionTranslationActionClick(target);
  }

  async onSelectionTranslateRetry(): Promise<void> {
    await this.onSelectionTranslateActionClick();
  }

  private onCustomSelectionPointerDown(
    context: SelectionContext,
    messageId: string,
    event: PointerEvent,
  ): void {
    if (!this.useCustomSelectionMode()) {
      return;
    }

    const tokenIndex = this.resolveTokenIndexFromEventTarget(event.target, context, messageId);
    if (tokenIndex < 0) {
      this.dismissSelectionTranslateUi(false);
      return;
    }

    event.preventDefault();

    const currentTarget = event.currentTarget as HTMLElement | null;
    if (currentTarget && !currentTarget.hasPointerCapture(event.pointerId)) {
      currentTarget.setPointerCapture(event.pointerId);
    }

    this.customSelectionDragState = {
      active: true,
      pointerId: event.pointerId,
      context,
      messageId,
    };

    this.customSelection.set({
      context,
      messageId,
      startTokenIndex: tokenIndex,
      endTokenIndex: tokenIndex,
    });
  }

  private onCustomSelectionPointerMove(
    context: SelectionContext,
    messageId: string,
    event: PointerEvent,
  ): void {
    if (
      !this.customSelectionDragState.active ||
      this.customSelectionDragState.pointerId !== event.pointerId ||
      this.customSelectionDragState.context !== context ||
      this.customSelectionDragState.messageId !== messageId
    ) {
      return;
    }

    event.preventDefault();

    const tokenIndex = this.resolveTokenIndexFromPoint(
      event.clientX,
      event.clientY,
      context,
      messageId,
    );
    if (tokenIndex < 0) {
      return;
    }

    this.customSelection.update((selection) => {
      if (
        !selection ||
        selection.context !== context ||
        selection.messageId !== messageId ||
        selection.endTokenIndex === tokenIndex
      ) {
        return selection;
      }

      return {
        ...selection,
        endTokenIndex: tokenIndex,
      };
    });
  }

  private onCustomSelectionPointerUp(
    context: SelectionContext,
    messageId: string,
    event: PointerEvent,
  ): void {
    if (
      !this.customSelectionDragState.active ||
      this.customSelectionDragState.pointerId !== event.pointerId ||
      this.customSelectionDragState.context !== context ||
      this.customSelectionDragState.messageId !== messageId
    ) {
      return;
    }

    const currentTarget = event.currentTarget as HTMLElement | null;
    if (currentTarget?.hasPointerCapture(event.pointerId)) {
      currentTarget.releasePointerCapture(event.pointerId);
    }

    this.finalizeCustomSelection(context, messageId);
    this.endCustomSelectionDrag();
  }

  private onCustomSelectionPointerCancel(
    context: SelectionContext,
    messageId: string,
    event: PointerEvent,
  ): void {
    if (
      this.customSelectionDragState.pointerId !== event.pointerId ||
      this.customSelectionDragState.context !== context ||
      this.customSelectionDragState.messageId !== messageId
    ) {
      return;
    }

    this.endCustomSelectionDrag();
  }

  onAssistantTranscriptContextMenu(event: MouseEvent): void {
    if (!this.isIosStandalonePwa) {
      return;
    }

    event.preventDefault();
  }

  private async onSelectionTranslationActionClick(target: SelectionTranslateTarget): Promise<void> {
    const requestToken = this.bumpSelectionRequestToken();
    this.selectionTooltipVisible.set(true);
    this.selectionTooltipStatus.set('loading');
    this.selectionTooltipText.set('');
    this.selectionTooltipError.set(null);

    const result = await this.speakingStore.translateSelectedText({
      messageId: target.messageId,
      selectedText: target.selectedText,
      requestToken,
    });

    if (isSelectionTranslationResultStale(this.selectionRequestToken, result.requestToken)) {
      return;
    }

    if (result.status === 'success') {
      this.selectionTooltipStatus.set('success');
      this.selectionTooltipText.set(result.translatedText);
      this.selectionTooltipError.set(null);
      return;
    }

    this.selectionTooltipStatus.set('error');
    this.selectionTooltipText.set('');
    this.selectionTooltipError.set(result.errorMessage);
  }

  private async onSelectionPronunciationActionClick(
    target: SelectionTranslateTarget,
  ): Promise<void> {
    const requestToken = this.bumpSelectionRequestToken();
    this.selectionTooltipVisible.set(false);
    this.selectionTooltipStatus.set('idle');
    this.selectionTooltipText.set('');
    this.selectionTooltipError.set(null);
    this.ttsStore.clearError();

    await this.ttsStore.play(target.selectedText);

    if (isSelectionTranslationResultStale(this.selectionRequestToken, requestToken)) {
      return;
    }

    if (this.ttsStore.error()) {
      return;
    }

    this.markPronunciationReady(target);
  }

  onSelectionTooltipClose(): void {
    this.dismissSelectionTranslateUi(true);
  }

  onSelectionModalBackdropClick(): void {
    this.dismissSelectionTranslateUi(true);
  }

  onSelectionOverlayMouseDown(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  async onSummarize(): Promise<void> {
    if (this.hasConversationSummary()) {
      return;
    }

    await this.speakingStore.summarizeCurrentConversation();
  }

  async onCopySummary(message: SpeakingMessage): Promise<void> {
    const summary = message.text?.trim();
    if (!summary) {
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(summary);
      this.copiedSummaryMessageId.set(message.id);

      if (this.copySummaryResetTimer) {
        clearTimeout(this.copySummaryResetTimer);
      }

      this.copySummaryResetTimer = setTimeout(() => {
        this.copiedSummaryMessageId.update((current) => (current === message.id ? null : current));
        this.copySummaryResetTimer = null;
      }, 1500);
    } catch {
      // Ignore clipboard failures to keep speaking flow uninterrupted.
    }
  }

  toggleAssistantPanel(): void {
    this.assistantPanelOpen.update((open) => !open);
    this.clampAssistantPanelBounds();
  }

  onAssistantInputKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.isComposing) {
      return;
    }

    if (!event.metaKey && !event.ctrlKey) {
      return;
    }

    event.preventDefault();
    void this.onSendAssistantMessage();
  }

  async onSendAssistantMessage(): Promise<void> {
    const content = this.assistantInputControl.value.trim();
    if (!content) {
      return;
    }

    this.assistantInputControl.setValue('');
    await this.speakingStore.sendAssistantMessage(content);
  }

  onClearAssistantChat(): void {
    this.speakingStore.clearAssistantMessages();
  }

  onAssistantPanelPointerDown(event: PointerEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-assistant-drag-handle="true"]')) {
      return;
    }

    if (target.closest('button,textarea,input,select,a,[role="button"]')) {
      return;
    }

    const panel = this.assistantPanelRef?.nativeElement;
    if (!panel) {
      return;
    }

    event.preventDefault();

    const rect = panel.getBoundingClientRect();
    this.assistantDragState = {
      active: true,
      pointerId: event.pointerId,
      offsetY: event.clientY - rect.top,
    };

    panel.setPointerCapture(event.pointerId);
  }

  onAssistantPanelPointerMove(event: PointerEvent): void {
    if (!this.assistantDragState.active || this.assistantDragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();

    const topMargin = this.getAssistantTopMargin();
    const maxTop = Math.max(
      topMargin,
      window.innerHeight - this.assistantPanelHeight() - ASSISTANT_PANEL_SAFE_BOTTOM,
    );

    const nextTop = event.clientY - this.assistantDragState.offsetY;
    this.assistantPanelTop.set(Math.min(Math.max(nextTop, topMargin), maxTop));
  }

  onAssistantPanelPointerEnd(event: PointerEvent): void {
    if (this.assistantDragState.pointerId !== event.pointerId) {
      return;
    }

    this.assistantDragState = {
      active: false,
      pointerId: -1,
      offsetY: 0,
    };

    this.saveAssistantPanelTop(this.assistantPanelTop());

    const panel = this.assistantPanelRef?.nativeElement;
    if (panel?.hasPointerCapture(event.pointerId)) {
      panel.releasePointerCapture(event.pointerId);
    }
  }

  onAssistantResizePointerDown(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const target = event.currentTarget as HTMLElement | null;

    this.assistantResizeState = {
      active: true,
      pointerId: event.pointerId,
      startHeight: this.assistantPanelHeight(),
      startClientY: event.clientY,
    };

    target?.setPointerCapture(event.pointerId);
  }

  onAssistantResizePointerMove(event: PointerEvent): void {
    if (
      !this.assistantResizeState.active ||
      this.assistantResizeState.pointerId !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const deltaY = event.clientY - this.assistantResizeState.startClientY;
    const maxHeight = Math.max(
      ASSISTANT_PANEL_MIN_HEIGHT,
      window.innerHeight - this.assistantPanelTop() - ASSISTANT_PANEL_SAFE_BOTTOM,
    );

    const nextHeight = Math.min(
      Math.max(this.assistantResizeState.startHeight + deltaY, ASSISTANT_PANEL_MIN_HEIGHT),
      maxHeight,
    );

    this.assistantPanelHeight.set(nextHeight);
  }

  onAssistantResizePointerEnd(event: PointerEvent): void {
    if (this.assistantResizeState.pointerId !== event.pointerId) {
      return;
    }

    this.assistantResizeState = {
      active: false,
      pointerId: -1,
      startHeight: ASSISTANT_PANEL_INITIAL_HEIGHT,
      startClientY: 0,
    };

    this.saveAssistantPanelHeight(this.assistantPanelHeight());

    const target = event.currentTarget as HTMLElement | null;
    if (target?.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
  }

  toggleNotePanel(): void {
    this.notePanelOpen.update((open) => !open);
    this.clampNotePanelBounds();
  }

  onNoteTextInput(value: string): void {
    this.noteText.set(value);
    this.saveNoteText(value);
  }

  onNotePanelPointerDown(event: PointerEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-note-drag-handle="true"]')) {
      return;
    }

    if (target.closest('button,textarea,input,select,a,[role="button"]')) {
      return;
    }

    const panel = this.notePanelRef?.nativeElement;
    if (!panel) {
      return;
    }

    event.preventDefault();

    const rect = panel.getBoundingClientRect();
    this.noteDragState = {
      active: true,
      pointerId: event.pointerId,
      offsetY: event.clientY - rect.top,
    };

    panel.setPointerCapture(event.pointerId);
  }

  onNotePanelPointerMove(event: PointerEvent): void {
    if (!this.noteDragState.active || this.noteDragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();

    const topMargin = this.getNoteTopMargin();
    const maxTop = Math.max(
      topMargin,
      window.innerHeight - this.notePanelHeight() - NOTE_PANEL_SAFE_BOTTOM,
    );

    const nextTop = event.clientY - this.noteDragState.offsetY;
    this.notePanelTop.set(Math.min(Math.max(nextTop, topMargin), maxTop));
  }

  onNotePanelPointerEnd(event: PointerEvent): void {
    if (this.noteDragState.pointerId !== event.pointerId) {
      return;
    }

    this.noteDragState = {
      active: false,
      pointerId: -1,
      offsetY: 0,
    };

    const panel = this.notePanelRef?.nativeElement;
    if (panel?.hasPointerCapture(event.pointerId)) {
      panel.releasePointerCapture(event.pointerId);
    }
  }

  onNoteResizePointerDown(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const target = event.currentTarget as HTMLElement | null;

    this.noteResizeState = {
      active: true,
      pointerId: event.pointerId,
      startHeight: this.notePanelHeight(),
      startClientY: event.clientY,
    };

    target?.setPointerCapture(event.pointerId);
  }

  onNoteResizePointerMove(event: PointerEvent): void {
    if (!this.noteResizeState.active || this.noteResizeState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const deltaY = event.clientY - this.noteResizeState.startClientY;
    const maxHeight = Math.max(
      NOTE_PANEL_MIN_HEIGHT,
      window.innerHeight - this.notePanelTop() - NOTE_PANEL_SAFE_BOTTOM,
    );

    const nextHeight = Math.min(
      Math.max(this.noteResizeState.startHeight + deltaY, NOTE_PANEL_MIN_HEIGHT),
      maxHeight,
    );

    this.notePanelHeight.set(nextHeight);
  }

  onNoteResizePointerEnd(event: PointerEvent): void {
    if (this.noteResizeState.pointerId !== event.pointerId) {
      return;
    }

    this.noteResizeState = {
      active: false,
      pointerId: -1,
      startHeight: NOTE_PANEL_INITIAL_HEIGHT,
      startClientY: 0,
    };

    this.saveNotePanelHeight(this.notePanelHeight());

    const target = event.currentTarget as HTMLElement | null;
    if (target?.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
  }

  clearError(): void {
    this.speakingStore.clearError();
    this.recorder.clearError();
  }

  formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  formatCostTwd(value: number): string {
    if (!Number.isFinite(value) || value <= 0) {
      return '0.0000';
    }

    return value >= 1 ? value.toFixed(2) : value.toFixed(4);
  }

  private applySelectionTarget(
    context: SelectionContext,
    messageId: string,
    selectedText: string,
    rect: DOMRect,
  ): void {
    const normalizedText = selectedText.trim();
    if (!normalizedText) {
      this.dismissSelectionTranslateUi(false);
      return;
    }

    const current = this.selectionTranslateTarget();
    const selectionChanged =
      !current ||
      current.context !== context ||
      current.messageId !== messageId ||
      current.selectedText !== normalizedText;

    if (selectionChanged) {
      this.bumpSelectionRequestToken();
      this.selectionTooltipVisible.set(false);
      this.selectionTooltipStatus.set('idle');
      this.selectionTooltipText.set('');
      this.selectionTooltipError.set(null);
    }

    this.selectionTranslateTarget.set({ context, messageId, selectedText: normalizedText });
    this.updateSelectionOverlayPositions(rect);
  }

  private normalizeTokenRange(startTokenIndex: number, endTokenIndex: number): [number, number] {
    return startTokenIndex <= endTokenIndex
      ? [startTokenIndex, endTokenIndex]
      : [endTokenIndex, startTokenIndex];
  }

  private resolveTokenIndexFromEventTarget(
    target: EventTarget | null,
    context: SelectionContext,
    messageId: string,
  ): number {
    const element = target instanceof Element ? target : null;
    const tokenElement = element?.closest<HTMLElement>('[data-token-index]');
    if (!tokenElement) {
      return -1;
    }

    const host = tokenElement.closest<HTMLElement>('[data-speaking-assistant-message-id]');
    if (!host || host.dataset['speakingAssistantMessageId'] !== messageId) {
      return -1;
    }

    const hostContext = this.resolveSelectionContextFromHost(host);
    if (hostContext !== context) {
      return -1;
    }

    const index = Number.parseInt(tokenElement.dataset['tokenIndex'] ?? '', 10);
    return Number.isFinite(index) ? index : -1;
  }

  private resolveTokenIndexFromPoint(
    clientX: number,
    clientY: number,
    context: SelectionContext,
    messageId: string,
  ): number {
    if (typeof document === 'undefined') {
      return -1;
    }

    const element = document.elementFromPoint(clientX, clientY);
    return this.resolveTokenIndexFromEventTarget(element, context, messageId);
  }

  private finalizeCustomSelection(context: SelectionContext, messageId: string): void {
    const selection = this.customSelection();
    if (!selection || selection.context !== context || selection.messageId !== messageId) {
      return;
    }

    const tokens = this.resolveSelectionTokens(context, messageId);
    if (tokens.length === 0) {
      this.dismissSelectionTranslateUi(false);
      return;
    }

    const [start, end] = this.normalizeTokenRange(
      selection.startTokenIndex,
      selection.endTokenIndex,
    );
    const selectedText = tokens.slice(start, end + 1).join('');
    const rect = this.resolveCustomSelectionRect(context, messageId, start, end);
    if (!rect) {
      this.dismissSelectionTranslateUi(false);
      return;
    }

    this.applySelectionTarget(context, messageId, selectedText, rect);
  }

  private endCustomSelectionDrag(): void {
    this.customSelectionDragState = {
      active: false,
      pointerId: -1,
      context: null,
      messageId: null,
    };
  }

  private resolveCustomSelectionRect(
    context: SelectionContext,
    messageId: string,
    startTokenIndex: number,
    endTokenIndex: number,
  ): DOMRect | null {
    if (typeof document === 'undefined') {
      return null;
    }

    const selectorPrefix =
      `[data-speaking-selection-context="${context}"]` +
      `[data-speaking-assistant-message-id="${messageId}"]`;
    const startElement = document.querySelector<HTMLElement>(
      `${selectorPrefix} [data-token-index="${startTokenIndex}"]`,
    );
    const endElement = document.querySelector<HTMLElement>(
      `${selectorPrefix} [data-token-index="${endTokenIndex}"]`,
    );

    if (!startElement || !endElement) {
      return null;
    }

    return this.createRectFromPair(
      startElement.getBoundingClientRect(),
      endElement.getBoundingClientRect(),
    );
  }

  private createRectFromPair(first: DOMRect, second: DOMRect): DOMRect {
    const left = Math.min(first.left, second.left);
    const top = Math.min(first.top, second.top);
    const right = Math.max(first.right, second.right);
    const bottom = Math.max(first.bottom, second.bottom);

    return new DOMRect(left, top, Math.max(right - left, 1), Math.max(bottom - top, 1));
  }

  private detectIosStandalonePwa(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false;
    }

    const ua = navigator.userAgent ?? '';
    const iOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!iOS) {
      return false;
    }

    const standaloneViaDisplayMode =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches;
    const standaloneViaNavigator =
      'standalone' in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    return standaloneViaDisplayMode || standaloneViaNavigator;
  }

  private resolveAssistantSelectionHost(
    anchorNode: Node | null,
    focusNode: Node | null,
  ): HTMLElement | null {
    const anchorHost = this.resolveSelectionHostFromNode(anchorNode);
    const focusHost = this.resolveSelectionHostFromNode(focusNode);

    if (!anchorHost || !focusHost || anchorHost !== focusHost) {
      return null;
    }

    return anchorHost;
  }

  private resolveSelectionHostFromNode(node: Node | null): HTMLElement | null {
    if (!node) {
      return null;
    }

    const element = node instanceof Element ? node : node.parentElement;
    if (!element) {
      return null;
    }

    return element.closest<HTMLElement>('[data-speaking-assistant-message-id]');
  }

  private resolveSelectionContextFromHost(host: HTMLElement): SelectionContext | null {
    const rawContext = host.dataset['speakingSelectionContext'];
    if (!rawContext || rawContext === MAIN_TRANSCRIPT_CONTEXT) {
      return MAIN_TRANSCRIPT_CONTEXT;
    }

    if (rawContext === ASSISTANT_PANEL_CONTEXT) {
      return ASSISTANT_PANEL_CONTEXT;
    }

    return null;
  }

  private updateSelectionOverlayPositions(rect: DOMRect): void {
    const actionTopCandidate = rect.top - SELECTION_ACTION_HEIGHT - SELECTION_OVERLAY_GAP;
    const actionTop =
      actionTopCandidate < SELECTION_OVERLAY_SAFE_MARGIN
        ? rect.bottom + SELECTION_OVERLAY_GAP
        : actionTopCandidate;

    const centerX = rect.left + rect.width / 2;
    const actionLeft = this.clampOverlayCoordinate(
      centerX - SELECTION_ACTION_WIDTH / 2,
      SELECTION_ACTION_WIDTH,
    );

    this.selectionActionPosition.set({ left: actionLeft, top: actionTop });
  }

  private repositionSelectionOverlays(): void {
    const target = this.selectionTranslateTarget();
    if (!target) {
      return;
    }

    let rect: DOMRect | null = null;

    if (this.useCustomSelectionMode()) {
      const selection = this.customSelection();
      if (
        !selection ||
        selection.context !== target.context ||
        selection.messageId !== target.messageId
      ) {
        return;
      }

      const [start, end] = this.normalizeTokenRange(
        selection.startTokenIndex,
        selection.endTokenIndex,
      );
      rect = this.resolveCustomSelectionRect(target.context, target.messageId, start, end);
    } else if (typeof window !== 'undefined') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return;
      }
      rect = selection.getRangeAt(0).getBoundingClientRect();
    }

    if (!rect || (rect.width <= 0 && rect.height <= 0)) {
      return;
    }

    this.updateSelectionOverlayPositions(rect);
  }

  private clampOverlayCoordinate(value: number, width: number): number {
    if (typeof window === 'undefined') {
      return value;
    }

    const max = Math.max(
      SELECTION_OVERLAY_SAFE_MARGIN,
      window.innerWidth - width - SELECTION_OVERLAY_SAFE_MARGIN,
    );
    return Math.min(Math.max(value, SELECTION_OVERLAY_SAFE_MARGIN), max);
  }

  private dismissSelectionTranslateUi(clearNativeSelection: boolean): void {
    this.selectionTranslateTarget.set(null);
    this.customSelection.set(null);
    this.endCustomSelectionDrag();
    this.selectionTooltipVisible.set(false);
    this.selectionTooltipStatus.set('idle');
    this.selectionTooltipText.set('');
    this.selectionTooltipError.set(null);

    if (!clearNativeSelection || typeof window === 'undefined') {
      return;
    }

    const selection = window.getSelection();
    selection?.removeAllRanges();
  }

  private bumpSelectionRequestToken(): number {
    this.selectionRequestToken += 1;
    return this.selectionRequestToken;
  }

  private getTokensWithCache(cachePrefix: string, sourceText: string): string[] {
    const cacheKey = `${cachePrefix}:${sourceText}`;
    const cached = this.transcriptTokenCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const tokens = sourceText.split(/(\s+)/).filter((token) => token.length > 0);
    this.transcriptTokenCache.set(cacheKey, tokens);
    return tokens;
  }

  private resolveSelectionTokens(context: SelectionContext, messageId: string): string[] {
    if (context === MAIN_TRANSCRIPT_CONTEXT) {
      const message = this.messages().find((item) => item.id === messageId);
      return message ? this.getTranscriptTokens(message) : [];
    }

    const assistantMessage = this.assistantMessages().find(
      (item) => item.id === messageId && item.role === 'assistant',
    );
    return assistantMessage ? this.getAssistantMessageTokens(assistantMessage) : [];
  }

  private isPronunciationTarget(target: SelectionTranslateTarget | null): boolean {
    return target?.context === ASSISTANT_PANEL_CONTEXT;
  }

  private createPronunciationReadyKey(target: SelectionTranslateTarget): string {
    return `${target.context}:${target.messageId}:${target.selectedText}`;
  }

  private markPronunciationReady(target: SelectionTranslateTarget): void {
    const key = this.createPronunciationReadyKey(target);
    this.pronunciationReadyKeys.update((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }

  private isSecureContext(): boolean {
    if (typeof window === 'undefined') {
      return true;
    }

    return window.isSecureContext;
  }

  private calculateUsageCostUsd(usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    promptTextTokens: number;
    promptAudioTokens: number;
    completionTextTokens: number;
    completionAudioTokens: number;
  }): number {
    if (!usage) {
      return 0;
    }

    const hasDetailedTokenBreakdown =
      usage.promptTextTokens > 0 ||
      usage.promptAudioTokens > 0 ||
      usage.completionTextTokens > 0 ||
      usage.completionAudioTokens > 0;

    if (!hasDetailedTokenBreakdown) {
      return (
        (usage.promptTokens / 1_000_000) * AUDIO_MODEL_TEXT_INPUT_USD_PER_MILLION +
        (usage.completionTokens / 1_000_000) * AUDIO_MODEL_TEXT_OUTPUT_USD_PER_MILLION
      );
    }

    const promptTextCost =
      (usage.promptTextTokens / 1_000_000) * AUDIO_MODEL_TEXT_INPUT_USD_PER_MILLION;
    const promptAudioCost =
      (usage.promptAudioTokens / 1_000_000) * AUDIO_MODEL_AUDIO_INPUT_USD_PER_MILLION;
    const completionTextCost =
      (usage.completionTextTokens / 1_000_000) * AUDIO_MODEL_TEXT_OUTPUT_USD_PER_MILLION;
    const completionAudioCost =
      (usage.completionAudioTokens / 1_000_000) * AUDIO_MODEL_AUDIO_OUTPUT_USD_PER_MILLION;

    return promptTextCost + promptAudioCost + completionTextCost + completionAudioCost;
  }

  private async tryLoadConversation(conversationId: string): Promise<void> {
    this.dismissSelectionTranslateUi(true);
    this.speakingStore.refreshSpeakingSettings();
    const loaded = await this.speakingStore.loadConversation(conversationId);

    if (!loaded) {
      await this.speakingStore.startNewConversation();
      await this.router.navigate(['/speaking']);
    }
  }

  private restoreAssistantMessages(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const raw = localStorage.getItem(ASSISTANT_MESSAGES_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as SpeakingAssistantMessage[];
      if (!Array.isArray(parsed)) {
        return;
      }

      this.speakingStore.hydrateAssistantMessages(parsed);
    } catch {
      // Ignore invalid cached payload.
    }
  }

  private saveAssistantMessages(messages: SpeakingAssistantMessage[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(ASSISTANT_MESSAGES_STORAGE_KEY, JSON.stringify(messages));
  }

  private scrollAssistantMessagesToBottom(): void {
    const container = this.assistantMessagesRef?.nativeElement;
    if (!container) {
      return;
    }

    queueMicrotask(() => {
      container.scrollTop = container.scrollHeight;
    });
  }

  private scrollSpeakingMessagesToBottom(): void {
    queueMicrotask(() => {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        return;
      }

      const scrollingElement = document.scrollingElement;
      if (!scrollingElement) {
        return;
      }

      window.scrollTo({ top: scrollingElement.scrollHeight });
    });
  }

  private loadAssistantPanelHeight(): number {
    if (typeof localStorage === 'undefined') {
      return ASSISTANT_PANEL_INITIAL_HEIGHT;
    }

    const parsed = Number.parseInt(localStorage.getItem(ASSISTANT_HEIGHT_STORAGE_KEY) ?? '', 10);
    if (!Number.isFinite(parsed)) {
      return ASSISTANT_PANEL_INITIAL_HEIGHT;
    }

    return Math.max(ASSISTANT_PANEL_MIN_HEIGHT, parsed);
  }

  private saveAssistantPanelHeight(value: number): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(ASSISTANT_HEIGHT_STORAGE_KEY, String(Math.round(value)));
  }

  private loadAssistantPanelTop(): number {
    if (typeof localStorage === 'undefined') {
      return this.initialAssistantPanelTop();
    }

    const parsed = Number.parseInt(localStorage.getItem(ASSISTANT_TOP_STORAGE_KEY) ?? '', 10);
    if (!Number.isFinite(parsed)) {
      return this.initialAssistantPanelTop();
    }

    return Math.max(this.getAssistantTopMargin(), parsed);
  }

  private saveAssistantPanelTop(value: number): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(ASSISTANT_TOP_STORAGE_KEY, String(Math.round(value)));
  }

  private initialAssistantPanelTop(): number {
    if (typeof window === 'undefined') {
      return 96;
    }

    const topMargin = this.getAssistantTopMargin();
    const maxTop = Math.max(
      topMargin,
      window.innerHeight - ASSISTANT_PANEL_INITIAL_HEIGHT - ASSISTANT_PANEL_SAFE_BOTTOM,
    );

    return Math.min(Math.max(96, topMargin), maxTop);
  }

  private clampAssistantPanelBounds(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const clampedTop = this.clampAssistantTop(
      this.assistantPanelTop(),
      this.assistantPanelHeight(),
    );
    this.assistantPanelTop.set(clampedTop);

    const clampedHeight = this.clampAssistantHeight(this.assistantPanelHeight(), clampedTop);
    this.assistantPanelHeight.set(clampedHeight);
  }

  private clampAssistantHeight(height: number, top: number): number {
    const maxHeight = Math.max(
      ASSISTANT_PANEL_MIN_HEIGHT,
      window.innerHeight - top - ASSISTANT_PANEL_SAFE_BOTTOM,
    );
    return Math.min(Math.max(height, ASSISTANT_PANEL_MIN_HEIGHT), maxHeight);
  }

  private clampAssistantTop(top: number, height: number): number {
    const topMargin = this.getAssistantTopMargin();
    const maxTop = Math.max(topMargin, window.innerHeight - height - ASSISTANT_PANEL_SAFE_BOTTOM);
    return Math.min(Math.max(top, topMargin), maxTop);
  }

  private loadNoteText(): string {
    if (typeof localStorage === 'undefined') {
      return '';
    }

    return localStorage.getItem(NOTE_STORAGE_KEY) ?? '';
  }

  private saveNoteText(value: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(NOTE_STORAGE_KEY, value);
  }

  private loadNotePanelHeight(): number {
    if (typeof localStorage === 'undefined') {
      return NOTE_PANEL_INITIAL_HEIGHT;
    }

    const parsed = Number.parseInt(localStorage.getItem(NOTE_HEIGHT_KEY) ?? '', 10);
    if (!Number.isFinite(parsed)) {
      return NOTE_PANEL_INITIAL_HEIGHT;
    }

    return Math.max(NOTE_PANEL_MIN_HEIGHT, parsed);
  }

  private saveNotePanelHeight(value: number): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(NOTE_HEIGHT_KEY, String(Math.round(value)));
  }

  private initialNotePanelTop(): number {
    if (typeof window === 'undefined') {
      return 96;
    }

    const topMargin = this.getNoteTopMargin();
    const maxTop = Math.max(
      topMargin,
      window.innerHeight - NOTE_PANEL_INITIAL_HEIGHT - NOTE_PANEL_SAFE_BOTTOM,
    );

    return Math.min(Math.max(96, topMargin), maxTop);
  }

  private clampNotePanelBounds(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const clampedTop = this.clampNoteTop(this.notePanelTop(), this.notePanelHeight());
    this.notePanelTop.set(clampedTop);

    const clampedHeight = this.clampNoteHeight(this.notePanelHeight(), clampedTop);
    this.notePanelHeight.set(clampedHeight);
  }

  private clampNoteHeight(height: number, top: number): number {
    const maxHeight = Math.max(
      NOTE_PANEL_MIN_HEIGHT,
      window.innerHeight - top - NOTE_PANEL_SAFE_BOTTOM,
    );
    return Math.min(Math.max(height, NOTE_PANEL_MIN_HEIGHT), maxHeight);
  }

  private clampNoteTop(top: number, height: number): number {
    const topMargin = this.getNoteTopMargin();
    const maxTop = Math.max(topMargin, window.innerHeight - height - NOTE_PANEL_SAFE_BOTTOM);
    return Math.min(Math.max(top, topMargin), maxTop);
  }

  private getAssistantTopMargin(): number {
    return this.getTopMarginWithSafeArea(ASSISTANT_PANEL_MARGIN);
  }

  private getNoteTopMargin(): number {
    return this.getTopMarginWithSafeArea(NOTE_PANEL_MARGIN);
  }

  private getTopMarginWithSafeArea(baseMargin: number): number {
    return Math.max(baseMargin, Math.ceil(this.getSafeAreaInsetTop() + baseMargin));
  }

  private getSafeAreaInsetTop(): number {
    if (this.safeAreaInsetMeasured) {
      return this.safeAreaInsetTop;
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return 0;
    }

    const host = document.body ?? document.documentElement;
    if (!host) {
      return 0;
    }

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

  protected readonly ASSISTANT_PANEL_SIDE_GAP = ASSISTANT_PANEL_SIDE_GAP;
  protected readonly NOTE_PANEL_SIDE_GAP = NOTE_PANEL_SIDE_GAP;
}
