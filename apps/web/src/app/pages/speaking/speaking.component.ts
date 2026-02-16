import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
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
import {
  type SpeakingAssistantMessage,
  type SpeakingMessage,
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
export class SpeakingComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly speakingStore = inject(SpeakingStore);
  readonly recorder = inject(SpeakingRecorderService);

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

  readonly notePanelOpen = signal(false);
  readonly noteText = signal(this.loadNoteText());
  readonly notePanelHeight = signal(this.loadNotePanelHeight());
  readonly notePanelTop = signal(this.initialNotePanelTop());
  readonly noteEditing = signal(false);
  readonly stoppingAndSending = signal(false);

  readonly canSummarize = computed(
    () =>
      this.messages().length > 0 &&
      !this.summarizing() &&
      !this.sending() &&
      !this.loadingConversation(),
  );

  readonly hasUserMessages = computed(() =>
    this.messages().some((message) => message.role === 'user'),
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

  constructor() {
    effect(() => {
      const messages = this.assistantMessages();
      this.saveAssistantMessages(messages);
      this.scrollAssistantMessagesToBottom();
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

  @HostListener('window:resize')
  onWindowResize(): void {
    this.clampNotePanelBounds();
    this.clampAssistantPanelBounds();
  }

  async onHeaderTitleClick(): Promise<void> {
    await this.router.navigate(['/home']);
  }

  async onStartNewConversation(): Promise<void> {
    this.recorder.cancel();
    await this.speakingStore.startNewConversation();
    await this.router.navigate(['/speaking']);
  }

  async onStartRecording(): Promise<void> {
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

  async onSummarize(): Promise<void> {
    await this.speakingStore.summarizeCurrentConversation();
  }

  toggleAssistantPanel(): void {
    this.assistantPanelOpen.update((open) => !open);
    this.clampAssistantPanelBounds();
  }

  onAssistantInputKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) {
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

    const maxTop = Math.max(
      ASSISTANT_PANEL_MARGIN,
      window.innerHeight - this.assistantPanelHeight() - ASSISTANT_PANEL_SAFE_BOTTOM,
    );

    const nextTop = event.clientY - this.assistantDragState.offsetY;
    this.assistantPanelTop.set(Math.min(Math.max(nextTop, ASSISTANT_PANEL_MARGIN), maxTop));
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

    const maxTop = Math.max(
      NOTE_PANEL_MARGIN,
      window.innerHeight - this.notePanelHeight() - NOTE_PANEL_SAFE_BOTTOM,
    );

    const nextTop = event.clientY - this.noteDragState.offsetY;
    this.notePanelTop.set(Math.min(Math.max(nextTop, NOTE_PANEL_MARGIN), maxTop));
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

  private isSecureContext(): boolean {
    if (typeof window === 'undefined') {
      return true;
    }

    return window.isSecureContext;
  }

  private async tryLoadConversation(conversationId: string): Promise<void> {
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

    return Math.max(ASSISTANT_PANEL_MARGIN, parsed);
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

    const maxTop = Math.max(
      ASSISTANT_PANEL_MARGIN,
      window.innerHeight - ASSISTANT_PANEL_INITIAL_HEIGHT - ASSISTANT_PANEL_SAFE_BOTTOM,
    );

    return Math.min(Math.max(96, ASSISTANT_PANEL_MARGIN), maxTop);
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
    const maxTop = Math.max(
      ASSISTANT_PANEL_MARGIN,
      window.innerHeight - height - ASSISTANT_PANEL_SAFE_BOTTOM,
    );
    return Math.min(Math.max(top, ASSISTANT_PANEL_MARGIN), maxTop);
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

    const maxTop = Math.max(
      NOTE_PANEL_MARGIN,
      window.innerHeight - NOTE_PANEL_INITIAL_HEIGHT - NOTE_PANEL_SAFE_BOTTOM,
    );

    return Math.min(Math.max(96, NOTE_PANEL_MARGIN), maxTop);
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
    const maxTop = Math.max(
      NOTE_PANEL_MARGIN,
      window.innerHeight - height - NOTE_PANEL_SAFE_BOTTOM,
    );
    return Math.min(Math.max(top, NOTE_PANEL_MARGIN), maxTop);
  }

  protected readonly ASSISTANT_PANEL_SIDE_GAP = ASSISTANT_PANEL_SIDE_GAP;
  protected readonly NOTE_PANEL_SIDE_GAP = NOTE_PANEL_SIDE_GAP;
}
