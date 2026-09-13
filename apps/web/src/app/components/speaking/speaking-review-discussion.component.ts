import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  afterRenderEffect,
  computed,
  signal,
  inject,
  input,
  output,
  viewChild,
  untracked,
} from '@angular/core';
import { FmButtonComponent, FmIconButtonComponent, FmPageHeaderComponent } from '@flashmind/ui';
import { TopicConversationComposerComponent } from '../../pages/topic-conversation/components/topic-conversation-composer.component';
import { TopicConversationMessageComponent } from '../../pages/topic-conversation/components/topic-conversation-message.component';
import {
  isSelectionTranslationResultStale,
  type SpeakingConversation,
  type SpeakingMessage,
  type SpeakingReviewMarkedContext,
} from './speaking.domain';
import { SpeakingSummaryComponent } from './speaking-summary.component';
import { SpeakingReviewDiscussionStore } from './speaking-review-discussion.store';
import { SpeakingStore } from './speaking.store';
import { TtsStore } from '../tts/tts.store';
import {
  findSelectionWord,
  mergeSelectionRects,
  snapSelectionPoint,
  type SelectionRect,
} from './speaking-selection.domain';
import { SpeakingSelectionMagnifierComponent } from './speaking-selection-magnifier.component';

type SelectionTooltipStatus = 'idle' | 'loading' | 'success' | 'error';

interface SelectionTranslateTarget {
  messageId: string;
  selectedText: string;
}

interface SelectionTextNodeEntry {
  node: Text;
  start: number;
  end: number;
}

interface MobileSelectionDraft {
  messageId: string;
  start: number;
  end: number;
  selectedText: string;
}

interface SelectionLayout {
  entries: SelectionTextNodeEntry[];
  fullText: string;
  textRects: SelectionRect[];
  glyphs?: (SelectionRect & { start: number; end: number })[];
}

interface MobileSelectionGesture extends SelectionLayout {
  pointerType: string;
  edge?: 'start' | 'end';
  shift?: { x: number; y: number };
  word?: { start: number; end: number };
  pendingPoint?: { x: number; y: number };
  pointerId: number;
  host: HTMLElement;
  messageId: string;
  startOffset: number;
  lastOffset: number;
  startPoint: { x: number; y: number };
  active: boolean;
  longPressTimer: number | null;
}

interface DocumentWithCaretApi {
  caretPositionFromPoint?: (x: number, y: number) => CaretPosition | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
}

@Component({
  selector: 'app-speaking-review-discussion',
  imports: [
    SpeakingSelectionMagnifierComponent,
    FmButtonComponent,
    FmIconButtonComponent,
    FmPageHeaderComponent,
    SpeakingSummaryComponent,
    TopicConversationComposerComponent,
    TopicConversationMessageComponent,
  ],
  providers: [SpeakingReviewDiscussionStore, TtsStore],
  host: { '(document:contextmenu)': 'onSelectionContextMenu($event)' },
  styleUrl: './speaking-review-discussion.component.css',
  template: `
    <div
      class="flex min-h-dvh flex-col"
      [class.mobile-selection-enabled]="mobileSelectionEnabled()"
      [class.mobile-selection-active]="mobileSelectionActive()"
      data-testid="speaking-review-discussion"
    >
      <fm-page-header title="討論改進方向" layout="center">
        <fm-button
          class="fm-header-left"
          variant="ghost"
          size="sm"
          testId="speaking-discussion-back"
          (click)="closed.emit()"
        >
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">chevron_left</span>
          返回
        </fm-button>
      </fm-page-header>
      <main class="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-5">
        <section
          aria-label="原對話與摘要"
          class="space-y-4"
          data-testid="speaking-discussion-source"
        >
          <h2 #sourceStart tabindex="-1" class="scroll-mt-24 text-lg font-semibold">
            原對話與摘要
          </h2>
          @for (item of originalMessages(); track item.source.id) {
            @if (item.source.role === 'summary') {
              <app-speaking-summary
                [content]="item.source.text ?? ''"
                [showCopy]="false"
                [initiallyCollapsed]="true"
                [flat]="true"
                [selectionMessageId]="item.source.id"
              />
            } @else {
              <app-topic-conversation-message [message]="item.message" presentation="source" />
              @if (item.source.translatedText) {
                <p class="text-sm text-slate-600 dark:text-slate-300">
                  {{ item.source.translatedText }}
                </p>
              }
            }
          }
          @if (!hasOriginalSummary() && conversation().summary) {
            <app-speaking-summary
              [content]="conversation().summary ?? ''"
              [showCopy]="false"
              [initiallyCollapsed]="true"
              [flat]="true"
              [selectionMessageId]="conversation().id"
            />
          }
        </section>
        <div class="pt-1" data-testid="speaking-discussion-start">
          <h2 class="mb-3 text-lg font-semibold">從這裡開始討論</h2>
          <div class="border-l-2 border-amber-400 pl-3">
            <p class="font-semibold">{{ conversation().title || '本次口說練習' }}</p>
            <p
              class="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300"
              data-testid="speaking-discussion-notice"
            >
              已帶入這次對話與回顧。後續討論不儲存，離開後即清除，也不會出現在原本的對話詳情。
            </p>
          </div>
        </div>
        <section
          class="-mx-4 px-4 py-1 sm:mx-0 sm:px-0"
          aria-label="後續討論訊息"
          data-testid="speaking-discussion-message-list"
        >
          <div
            class="mb-5 flex items-center gap-2 text-xs font-semibold tracking-wide text-primary"
          >
            <span class="material-symbols-outlined text-[17px]" aria-hidden="true"
              >auto_awesome</span
            >
            AI 回顧討論
          </div>
          <div class="space-y-5 sm:space-y-6">
            @for (message of store.messages(); track message.id) {
              <app-topic-conversation-message
                class="block"
                [message]="message"
                presentation="discussion"
              />
            }
            @if (store.sending()) {
              <p role="status" class="text-sm text-slate-600 dark:text-slate-300">正在整理建議…</p>
            }
            @if (store.error()) {
              <p role="alert" class="text-sm text-red-700 dark:text-red-300">
                {{ store.error() }}
              </p>
            }
          </div>
        </section>
        @if (mobileSelectionDraft() && selectionActionVisible() && !selectionNoteEditorVisible()) {
          @for (rect of mobileSelectionRects(); track $index) {
            <div
              class="selection-highlight"
              aria-hidden="true"
              data-speaking-selection-overlay="true"
              [style.left.px]="rect.left + selectionDocumentOffset().x"
              [style.top.px]="rect.top + selectionDocumentOffset().y"
              [style.width.px]="rect.width"
              [style.height.px]="rect.height"
            ></div>
          }
          @for (edge of selectionEdges; track edge) {
            <button
              type="button"
              class="selection-handle"
              [class.selection-handle-start]="edge === 'start'"
              [style.--line-height]="selectionHandles()[edge].height + 'px'"
              data-speaking-selection-overlay="true"
              [attr.data-testid]="'speaking-selection-handle-' + edge"
              [attr.aria-label]="edge === 'start' ? '調整選取起點' : '調整選取終點'"
              [style.left.px]="selectionHandles()[edge].x + selectionDocumentOffset().x"
              [style.top.px]="selectionHandles()[edge].y + selectionDocumentOffset().y"
              (pointerdown)="onSelectionHandleDown($event, edge)"
            >
              <span aria-hidden="true"></span>
            </button>
          }
        }
        @if (selectionMagnifier(); as lens) {
          <app-speaking-selection-magnifier
            [source]="lens.source"
            [sourceWidth]="lens.sourceWidth"
            [point]="lens.point"
            [textHeight]="lens.textHeight"
            [left]="lens.left"
            [top]="lens.top"
            [highlights]="lens.highlights"
          />
        }
        @if (
          selectionActionVisible() && !mobileSelectionActive() && !selectionActionsSuppressed()
        ) {
          <div
            #selectionActionsElement
            class="selection-actions"
            [class.selection-actions-mobile]="mobileSelectionEnabled()"
            role="toolbar"
            aria-label="選取文字操作"
            data-testid="speaking-discussion-selection-actions"
            data-speaking-selection-overlay="true"
            [style.z-index]="70"
            [style.left.px]="selectionActionPosition().left"
            [style.top.px]="selectionActionPosition().top"
            (pointerdown)="onSelectionActionPointerDown($event)"
          >
            <button
              type="button"
              class="selection-action-button selection-translate-action"
              aria-label="翻譯選取文字"
              title="翻譯"
              data-testid="speaking-discussion-selection-translate-action"
              data-speaking-selection-overlay="true"
              (mousedown)="onSelectionOverlayMouseDown($event)"
              (click)="onSelectionTranslateActionClick()"
            >
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true"
                >translate</span
              >
              @if (mobileSelectionEnabled()) {
                <span>翻譯</span>
              }
            </button>
            <button
              type="button"
              class="selection-action-button selection-speech-action"
              [attr.aria-label]="
                selectionSpeechLoading()
                  ? '正在產生語音'
                  : selectionSpeechPlaying()
                    ? '暫停朗讀'
                    : '朗讀選取文字'
              "
              [attr.title]="
                selectionSpeechLoading()
                  ? '正在產生語音'
                  : selectionSpeechPlaying()
                    ? '暫停朗讀'
                    : '朗讀'
              "
              [disabled]="selectionSpeechLoading()"
              [attr.aria-busy]="selectionSpeechLoading()"
              data-testid="speaking-discussion-selection-speech-action"
              data-speaking-selection-overlay="true"
              (mousedown)="onSelectionOverlayMouseDown($event)"
              (click)="onSelectionSpeechActionClick()"
            >
              <span
                class="material-symbols-outlined text-[18px]"
                aria-hidden="true"
                [class.animate-spin]="selectionSpeechLoading()"
                >{{
                  selectionSpeechLoading()
                    ? 'progress_activity'
                    : selectionSpeechPlaying()
                      ? 'pause'
                      : 'volume_up'
                }}</span
              >
              @if (mobileSelectionEnabled()) {
                <span>{{ selectionSpeechPlaying() ? '暫停' : '朗讀' }}</span>
              }
            </button>
            <button
              type="button"
              class="selection-action-button selection-mark-action"
              aria-label="標記選取文字"
              title="標記"
              data-testid="speaking-discussion-selection-mark-action"
              data-speaking-selection-overlay="true"
              (mousedown)="onSelectionOverlayMouseDown($event)"
              (click)="onSelectionMarkActionClick()"
            >
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true"
                >edit_note</span
              >
              @if (mobileSelectionEnabled()) {
                <span>標記</span>
              }
            </button>
          </div>
          @if (selectionSpeechError(); as error) {
            <p
              class="selection-speech-feedback"
              role="alert"
              data-speaking-selection-overlay="true"
              data-testid="speaking-discussion-selection-speech-error"
              [style.top.px]="selectionActionPosition().top + 56"
            >
              {{ error }}
            </p>
          }
        }
        @if (selectionTooltipVisible() && selectionTranslateTarget(); as selectionTarget) {
          <div
            class="selection-translate-modal-backdrop"
            data-speaking-selection-overlay="true"
            [style.z-index]="72"
            (mousedown)="onSelectionModalBackdropClick()"
          >
            <section
              class="selection-translate-modal"
              data-testid="speaking-discussion-selection-translate-tooltip"
              data-speaking-selection-overlay="true"
              (mousedown)="onSelectionOverlayMouseDown($event)"
            >
              <header class="selection-translate-tooltip-header">
                <p class="selection-translate-tooltip-title">片段翻譯</p>
                <button
                  type="button"
                  class="selection-translate-tooltip-close"
                  aria-label="關閉翻譯彈窗"
                  data-testid="speaking-discussion-selection-translate-close"
                  (click)="onSelectionTooltipClose()"
                >
                  <span class="material-symbols-outlined text-[16px]">close</span>
                </button>
              </header>
              <p class="selection-translate-source">{{ selectionTarget.selectedText }}</p>
              @if (selectionTooltipStatus() === 'loading') {
                <div class="selection-translate-loading">
                  <span>翻譯中</span>
                  <span class="dot-bounce"></span>
                  <span class="dot-bounce [animation-delay:150ms]"></span>
                  <span class="dot-bounce [animation-delay:300ms]"></span>
                </div>
              }
              @if (selectionTooltipStatus() === 'success') {
                <p class="selection-translate-result">{{ selectionTooltipText() }}</p>
              }
              @if (selectionTooltipStatus() === 'error') {
                <div class="selection-translate-error-wrap">
                  <p class="selection-translate-error">{{ selectionTooltipError() }}</p>
                  <button
                    type="button"
                    class="selection-translate-retry"
                    (click)="onSelectionTranslateRetry()"
                  >
                    重試
                  </button>
                </div>
              }
            </section>
          </div>
        }
        @if (selectionNoteEditorVisible() && selectionNoteTarget(); as noteTarget) {
          <div
            class="selection-note-editor"
            role="group"
            [attr.aria-label]="selectionNoteContextId() ? '編輯註解' : '新增註解'"
            data-testid="speaking-discussion-selection-note-editor"
            data-speaking-selection-overlay="true"
            [attr.data-speaking-note-message-id]="noteTarget.messageId"
            [style.z-index]="71"
            [style.left.px]="selectionNotePosition().left"
            [style.top.px]="selectionNotePosition().top"
          >
            <input
              #selectionNoteInput
              type="text"
              class="selection-note-editor-input"
              maxlength="500"
              [value]="selectionMarkNote()"
              [placeholder]="selectionNoteContextId() ? '編輯註解…' : '新增註解…'"
              [attr.aria-label]="
                selectionNoteContextId() ? '編輯註解，可留白只標記' : '註解內容，可留白只標記'
              "
              data-testid="speaking-discussion-selection-note-input"
              (compositionstart)="onSelectionNoteCompositionStart()"
              (compositionend)="onSelectionNoteCompositionEnd()"
              (input)="onSelectionMarkNoteInput($any($event.target).value)"
              (keydown)="onSelectionNoteKeydown($event)"
            />
            <button
              type="button"
              class="selection-note-editor-save"
              aria-label="完成註解"
              title="完成"
              data-testid="speaking-discussion-selection-note-save"
              (click)="saveSelectionMark()"
            >
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">check</span>
            </button>
          </div>
        }
        <div #bottom class="scroll-mb-44"></div>
      </main>
      <footer class="sticky bottom-0">
        <div class="mx-auto flex w-full max-w-3xl justify-end px-4 pt-2">
          <fm-icon-button
            variant="neutral"
            size="sm"
            class="rounded-full bg-background-light shadow-sm dark:bg-background-dark"
            [ariaLabel]="viewingSource() ? '回到後續討論' : '查看原對話與摘要'"
            testId="speaking-discussion-jump"
            (click)="toggleSource()"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">{{
              viewingSource() ? 'arrow_downward' : 'arrow_upward'
            }}</span>
          </fm-icon-button>
        </div>
        <app-topic-conversation-composer
          [showHint]="false"
          inputLabel="詢問這次對話可以改進的地方"
          placeholder="想先討論哪一句？"
          [maxMessageLength]="1000"
          [sending]="store.sending()"
          (messageSubmit)="send($event)"
        >
          @if (store.markedContexts().length > 0) {
            <div topic-conversation-composer-context class="selection-composer-context">
              @for (
                markedContext of store.markedContexts();
                track markedContext.id;
                let index = $index
              ) {
                <div
                  class="selection-annotation-chip"
                  role="group"
                  [class.selection-annotation-chip-active]="
                    selectionNoteContextId() === markedContext.id
                  "
                  [attr.aria-label]="'註解 ' + (index + 1)"
                  [attr.data-testid]="'speaking-discussion-annotation-chip-' + (index + 1)"
                >
                  <button
                    type="button"
                    class="selection-annotation-chip-main"
                    [attr.aria-label]="'前往註解 ' + (index + 1) + ' 並編輯'"
                    [attr.title]="'前往註解 ' + (index + 1) + ' 並編輯'"
                    [attr.data-testid]="'speaking-discussion-annotation-' + (index + 1)"
                    (click)="onMarkedContextBadgeClick(markedContext.id)"
                  >
                    <span class="material-symbols-outlined text-[15px]" aria-hidden="true"
                      >chat_bubble_outline</span
                    >
                    <span class="selection-annotation-chip-number">{{ index + 1 }}</span>
                  </button>
                  <button
                    type="button"
                    class="selection-annotation-chip-remove"
                    [attr.aria-label]="'刪除註解 ' + (index + 1)"
                    title="刪除"
                    [attr.data-testid]="'speaking-discussion-annotation-remove-' + (index + 1)"
                    (click)="removeMarkedContext(markedContext.id, $event)"
                  >
                    <span class="material-symbols-outlined text-[15px]" aria-hidden="true"
                      >close</span
                    >
                  </button>
                </div>
              }
            </div>
          }
        </app-topic-conversation-composer>
      </footer>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpeakingReviewDiscussionComponent implements OnInit {
  readonly conversation = input.required<SpeakingConversation>();
  readonly sourceMessages = input.required<SpeakingMessage[]>();
  readonly originalMessages = computed(() =>
    this.sourceMessages().map((source) => ({
      source,
      message: {
        id: source.id,
        role: source.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: source.text || '（原紀錄沒有逐字稿）',
        correction: null,
        createdAt: source.createdAt,
        streaming: false,
      },
    })),
  );
  readonly hasOriginalSummary = computed(() =>
    this.sourceMessages().some((message) => message.role === 'summary'),
  );
  readonly viewingSource = signal(false);
  readonly closed = output<void>();
  readonly store = inject(SpeakingReviewDiscussionStore);
  private readonly speakingStore = inject(SpeakingStore);
  private readonly tts = inject(TtsStore);
  readonly selectionSpeechError = signal<string | null>(null);
  readonly selectionSpeechLoading = computed(() => {
    const text = this.selectionTranslateTarget()?.selectedText;
    return !!text && this.tts.loadingText() === text;
  });
  readonly selectionSpeechPlaying = computed(() => {
    const text = this.selectionTranslateTarget()?.selectedText;
    return !!text && this.tts.playingText() === text;
  });
  readonly selectionTranslateTarget = signal<SelectionTranslateTarget | null>(null);
  readonly selectionActionPosition = signal({ left: 0, top: 0 });
  readonly selectionTooltipStatus = signal<SelectionTooltipStatus>('idle');
  readonly selectionTooltipVisible = signal(false);
  readonly selectionTooltipText = signal('');
  readonly selectionTooltipError = signal<string | null>(null);
  readonly selectionNoteTarget = signal<SelectionTranslateTarget | null>(null);
  readonly mobileSelectionDraft = signal<MobileSelectionDraft | null>(null);
  readonly mobileSelectionActive = signal(false);
  readonly selectionActionsSuppressed = signal(false);
  readonly selectionDocumentOffset = signal({ x: 0, y: 0 });
  readonly selectionEdges = ['start', 'end'] as const;
  readonly mobileSelectionRects = signal<SelectionRect[]>([]);
  readonly selectionHandles = signal({
    start: { x: 0, y: 0, height: 24 },
    end: { x: 0, y: 0, height: 24 },
  });
  readonly selectionMagnifier = signal<{
    source: HTMLElement;
    sourceWidth: number;
    textHeight: number;
    point: { x: number; y: number };
    left: number;
    top: number;
    highlights: SelectionRect[];
  } | null>(null);
  readonly selectionNoteEditorVisible = signal(false);
  readonly selectionNotePosition = signal({ left: 0, top: 0 });
  readonly selectionNoteComposing = signal(false);
  readonly selectionMarkNote = signal('');
  readonly selectionNoteContextId = signal<string | null>(null);
  readonly selectionActionVisible = computed(() => !!this.selectionTranslateTarget()?.selectedText);
  readonly mobileSelectionEnabled = computed(() => this.canUseMobileSelection());
  private selectionRequestToken = 0;
  private mobileSelectionGesture: MobileSelectionGesture | null = null;
  private selectionSource: Pick<
    MobileSelectionGesture,
    'host' | 'messageId' | 'entries' | 'fullText'
  > | null = null;
  private selectionTap: {
    pointerId: number;
    pointerType: string;
    x: number;
    y: number;
    moved: boolean;
  } | null = null;
  private selectionFrame: number | null = null;
  private selectionActionAnchor: DOMRect | null = null;
  private readonly selectionActionsElement =
    viewChild<ElementRef<HTMLElement>>('selectionActionsElement');
  private readonly positionSelectionActions = afterRenderEffect(() => {
    const element = this.selectionActionsElement()?.nativeElement;
    if (!element) return;
    const bounds = element.getBoundingClientRect();
    untracked(() => {
      if (this.selectionActionAnchor)
        this.updateSelectionActionPosition(this.selectionActionAnchor, bounds.width, bounds.height);
    });
  });
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly composer = viewChild(TopicConversationComposerComponent);
  private readonly sourceStart = viewChild<ElementRef<HTMLElement>>('sourceStart');
  private readonly bottom = viewChild<ElementRef<HTMLElement>>('bottom');
  private readonly selectionNoteInput =
    viewChild<ElementRef<HTMLInputElement>>('selectionNoteInput');
  private readonly scroll = afterRenderEffect(() => {
    this.store.messages();
    this.store.sending();
    if (this.viewingSource()) return;
    this.bottom()?.nativeElement.scrollIntoView({ block: 'end' });
  });
  private readonly markedSelectionDecoration = afterRenderEffect(() => {
    const contexts = this.store.markedContexts();
    this.store.messages();
    this.sourceMessages();
    this.decorateMarkedSelections(contexts);
  });
  private readonly mobileSelectionDecoration = afterRenderEffect(() => {
    this.store.markedContexts();
    this.store.messages();
    this.sourceMessages();
    untracked(() => this.cancelMobileSelectionGesture(true));
  });
  private readonly focusSelectionNoteInput = afterRenderEffect(() => {
    if (this.selectionNoteEditorVisible()) {
      this.selectionNoteInput()?.nativeElement.focus();
    }
  });

  constructor() {
    const root = this.hostElement.nativeElement;
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      this.cancelMobileSelectionGesture(true);
      this.tts.stop();
    });
    // touch-action 在手指落下時已決定；長按後才改 CSS 或取消 pointermove
    // 無法阻止當次捲動。必須預先註冊非 passive 的 touchmove listener。
    const onTouchMove = (event: TouchEvent) => this.onSelectionTouchMove(event);
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length > 1) {
        this.selectionTap = null;
        this.selectionActionsSuppressed.set(true);
        this.cancelMobileSelectionGesture(false);
      }
    };
    root.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    root.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    destroyRef.onDestroy(() => {
      root.removeEventListener('touchmove', onTouchMove, true);
      root.removeEventListener('touchstart', onTouchStart, true);
    });
  }

  private onSelectionTouchMove(event: TouchEvent): void {
    const point = event.touches[0];
    if (point) this.trackSelectionTapMovement(point.clientX, point.clientY);
    const gesture = this.mobileSelectionGesture;
    if (!gesture) return;
    if (event.touches.length !== 1 || !event.cancelable) {
      this.selectionActionsSuppressed.set(true);
      this.cancelMobileSelectionGesture(false);
      return;
    }

    const touch = event.touches[0];
    if (!gesture.active) {
      if (
        Math.hypot(touch.clientX - gesture.startPoint.x, touch.clientY - gesture.startPoint.y) > 10
      )
        this.cancelMobileSelectionGesture(false);
      // 等待長按時讓瀏覽器處理捲動；開始捲動後由 pointercancel 清除長按計時器。
      return;
    }

    // 只有長按選字成立或正在拖曳選取桿時，才阻止原生捲動。
    event.preventDefault();
  }

  ngOnInit(): void {
    this.selectionNoteEditorVisible.set(false);
    this.selectionNoteContextId.set(null);
    this.store.start(this.conversation(), this.sourceMessages());
  }

  toggleSource(): void {
    this.viewingSource.update((value) => !value);
    if (this.viewingSource()) {
      this.sourceStart()?.nativeElement.scrollIntoView({ block: 'start' });
      this.sourceStart()?.nativeElement.focus({ preventScroll: true });
    }
  }

  async send(message: string): Promise<void> {
    this.viewingSource.set(false);
    if (!(await this.store.sendMessage(message))) {
      const composer = this.composer();
      if (composer && !composer.formModel().message) composer.formModel.set({ message });
    }
  }

  @HostListener('document:selectionchange')
  onDocumentSelectionChange(): void {
    if (typeof window === 'undefined') return;
    if (this.selectionNoteEditorVisible()) return;
    // 觸控裝置由自訂圖層選取；桌面維持原生 Selection。
    if (this.mobileSelectionEnabled()) {
      // iOS 的組字與游標也會觸發 selectionchange，不能清除編輯中的原生選取。
      if (
        document.activeElement?.closest(
          'input, textarea, [contenteditable]:not([contenteditable="false"])',
        )
      ) {
        return;
      }
      const selection = window.getSelection();
      const anchor = this.resolveSelectionHost(selection?.anchorNode ?? null);
      const focus = this.resolveSelectionHost(selection?.focusNode ?? null);
      if (
        selection?.rangeCount &&
        anchor &&
        focus &&
        this.hostElement.nativeElement.contains(anchor) &&
        this.hostElement.nativeElement.contains(focus)
      ) {
        selection.removeAllRanges();
      }
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      this.dismissSelectionTranslation(false);
      return;
    }

    const selectedText = selection.toString().trim();
    const anchor = this.resolveSelectionHost(selection.anchorNode);
    const focus = this.resolveSelectionHost(selection.focusNode);
    if (
      !selectedText ||
      !anchor ||
      anchor !== focus ||
      !this.hostElement.nativeElement.contains(anchor)
    ) {
      this.dismissSelectionTranslation(false);
      return;
    }

    const messageId =
      anchor.dataset['speakingSelectionMessageId'] ?? anchor.dataset['speakingAssistantMessageId'];
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (!messageId || (rect.width <= 0 && rect.height <= 0)) return;

    const current = this.selectionTranslateTarget();
    if (current?.messageId !== messageId || current.selectedText !== selectedText) {
      this.selectionSpeechError.set(null);
      this.selectionRequestToken++;
      this.selectionTooltipVisible.set(false);
      this.selectionTooltipStatus.set('idle');
      this.selectionTooltipText.set('');
      this.selectionTooltipError.set(null);
    }

    this.selectionTranslateTarget.set({ messageId, selectedText });
    this.updateSelectionActionPosition(rect);
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[data-speaking-selection-overlay="true"]')) return;
    if (this.selectionNoteEditorVisible()) this.onSelectionNoteEditorClose();

    if (
      this.mobileSelectionDraft() &&
      !this.mobileSelectionActive() &&
      this.isTouchPointer(event) &&
      event.isPrimary
    ) {
      this.refreshMobileSelection();
      this.selectionTap = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        x: event.clientX,
        y: event.clientY,
        moved: false,
      };
      if (!this.isPointInMobileSelection(event.clientX, event.clientY))
        this.startMobileSelection(event, target);
      // 必須等放開才能區分輕點與捲頁，手指落下不清除既有反白。
      return;
    }

    if (this.mobileSelectionEnabled() && this.startMobileSelection(event, target)) return;
    if (target.closest('[data-speaking-selection-context="review-discussion"]')) return;
    this.dismissSelectionTranslation(false);
  }

  @HostListener('document:pointermove', ['$event'])
  onDocumentPointerMove(event: PointerEvent): void {
    if (
      this.selectionTap?.pointerId === event.pointerId &&
      this.selectionTap.pointerType === event.pointerType
    ) {
      this.trackSelectionTapMovement(event.clientX, event.clientY);
    }
    const gesture = this.mobileSelectionGesture;
    if (
      !gesture ||
      event.pointerId !== gesture.pointerId ||
      event.pointerType !== gesture.pointerType
    )
      return;

    const movedDistance = Math.hypot(
      event.clientX - gesture.startPoint.x,
      event.clientY - gesture.startPoint.y,
    );
    if (!gesture.active) {
      if (movedDistance > 10) this.cancelMobileSelectionGesture(false);
      return;
    }

    event.preventDefault();
    gesture.pendingPoint = { x: event.clientX, y: event.clientY };
    if (this.selectionFrame !== null) return;
    this.selectionFrame = window.requestAnimationFrame(() => {
      this.selectionFrame = null;
      this.flushSelectionMove();
    });
  }

  @HostListener('document:pointerup', ['$event'])
  onDocumentPointerUp(event: PointerEvent): void {
    const gesture = this.mobileSelectionGesture;
    const tap = this.selectionTap;
    if (tap?.pointerId === event.pointerId && tap.pointerType === event.pointerType) {
      this.trackSelectionTapMovement(event.clientX, event.clientY);
      this.selectionTap = null;
      this.cancelMobileSelectionGesture(false);
      if (!tap.moved) {
        this.refreshMobileSelection();
        if (this.isPointInMobileSelection(event.clientX, event.clientY)) {
          event.preventDefault();
          this.selectionActionsSuppressed.set(false);
        } else {
          this.dismissSelectionTranslation(false);
        }
      }
      return;
    }
    if (
      !gesture ||
      event.pointerId !== gesture.pointerId ||
      event.pointerType !== gesture.pointerType
    )
      return;

    if (gesture.active) event.preventDefault();
    this.flushSelectionMove();
    this.cancelSelectionFrame();
    this.clearMobileSelectionTimer(gesture);
    this.mobileSelectionGesture = null;
    this.mobileSelectionActive.set(false);
    this.selectionMagnifier.set(null);
    this.selectionActionsSuppressed.set(false);
  }

  @HostListener('document:pointercancel', ['$event'])
  onDocumentPointerCancel(event: PointerEvent): void {
    if (
      this.selectionTap?.pointerId === event.pointerId &&
      this.selectionTap.pointerType === event.pointerType
    ) {
      this.selectionTap = null;
      this.selectionActionsSuppressed.set(true);
      this.cancelMobileSelectionGesture(false);
      return;
    }
    const gesture = this.mobileSelectionGesture;
    if (
      !gesture ||
      event.pointerId !== gesture.pointerId ||
      event.pointerType !== gesture.pointerType
    )
      return;
    this.cancelMobileSelectionGesture(false);
    this.selectionActionsSuppressed.set(true);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target;
    const marker =
      target instanceof Element
        ? target.closest<HTMLElement>('[data-speaking-marked-context-id]')
        : null;
    if (!marker || !this.hostElement.nativeElement.contains(marker)) return;

    const id = marker.dataset['speakingMarkedContextId'];
    if (!id) return;
    event.preventDefault();
    this.onMarkedContextBadgeClick(id);
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const active = document.activeElement;
    const marker = active?.closest<HTMLElement>('[data-speaking-marked-context-id]');
    if (!marker || !this.hostElement.nativeElement.contains(marker)) return;

    const id = marker.dataset['speakingMarkedContextId'];
    if (!id) return;
    event.preventDefault();
    this.onMarkedContextBadgeClick(id);
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (this.mobileSelectionGesture) this.cancelMobileSelectionGesture(false);
    if (this.selectionTap) this.selectionTap.moved = true;
    if (this.selectionNoteEditorVisible()) {
      if (this.selectionNoteContextId()) {
        this.updateMarkedContextEditorPosition();
      } else {
        this.onSelectionNoteEditorClose();
      }
    }
    if (this.mobileSelectionDraft()) {
      this.selectionActionsSuppressed.set(true);
      this.refreshMobileSelection();
    } else {
      this.dismissSelectionTranslation(false);
    }
  }

  @HostListener('window:blur')
  onWindowBlur(): void {
    if (this.mobileSelectionGesture) this.cancelMobileSelectionGesture(true);
    this.dismissSelectionTranslation(true);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.mobileSelectionDraft()) {
      this.cancelMobileSelectionGesture(false);
      this.selectionActionsSuppressed.set(true);
      this.refreshMobileSelection();
      return;
    }
    if (this.selectionNoteEditorVisible()) {
      if (this.selectionNoteContextId()) this.updateMarkedContextEditorPosition();
      return;
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (this.selectionTranslateTarget()) {
      this.updateSelectionActionPosition(rect);
    }
  }

  async onSelectionSpeechActionClick(): Promise<void> {
    const target = this.selectionTranslateTarget();
    if (!target?.selectedText || this.selectionSpeechLoading()) return;
    this.selectionSpeechError.set(null);
    if (target.selectedText.length > 500) {
      this.selectionSpeechError.set('每次最多朗讀 500 字，請縮小選取範圍。');
      return;
    }
    this.tts.clearError();
    // 一律走 Azure 的句子 TTS，即使只選到單字也不使用 Google playWord。
    await this.tts.play(target.selectedText);
    const current = this.selectionTranslateTarget();
    if (current?.messageId === target.messageId && current.selectedText === target.selectedText) {
      this.selectionSpeechError.set(this.tts.error());
    }
  }

  async onSelectionTranslateActionClick(): Promise<void> {
    const target = this.selectionTranslateTarget();
    if (!target) return;

    const requestToken = ++this.selectionRequestToken;
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
      return;
    }

    this.selectionTooltipStatus.set('error');
    this.selectionTooltipError.set(result.errorMessage);
  }

  onSelectionMarkActionClick(): void {
    const target = this.selectionTranslateTarget();
    if (!target) return;

    // 第一次按下只建立文字標記；使用者再次點擊高亮文字時才開啟註解編輯。
    this.store.addMarkedContext({
      messageId: target.messageId,
      selectedText: target.selectedText,
      note: null,
    });
    this.dismissSelectionTranslation(false);
    if (typeof window !== 'undefined') window.getSelection()?.removeAllRanges();
  }

  onSelectionMarkNoteInput(note: string): void {
    this.selectionMarkNote.set(note);
  }

  onSelectionNoteCompositionStart(): void {
    this.selectionNoteComposing.set(true);
  }

  onSelectionNoteCompositionEnd(): void {
    this.selectionNoteComposing.set(false);
  }

  onSelectionNoteKeydown(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    // 部分瀏覽器在中文輸入法確認候選字時不提供 isComposing，只會回傳 keyCode 229。
    if (
      this.selectionNoteComposing() ||
      keyboardEvent.isComposing ||
      keyboardEvent.keyCode === 229
    ) {
      return;
    }
    if (keyboardEvent.key === 'Escape') {
      keyboardEvent.preventDefault();
      this.onSelectionNoteEditorClose();
      return;
    }
    if (keyboardEvent.key === 'Enter') {
      keyboardEvent.preventDefault();
      this.saveSelectionMark();
    }
  }

  saveSelectionMark(): void {
    const target = this.selectionNoteTarget();
    if (!target) return;

    const note = this.selectionMarkNote().trim();

    const contextId = this.selectionNoteContextId();
    if (contextId) {
      this.store.updateMarkedContext(contextId, note);
    } else {
      this.store.addMarkedContext({
        messageId: target.messageId,
        selectedText: target.selectedText,
        note,
      });
    }
    this.onSelectionNoteEditorClose();
  }

  onMarkedContextBadgeClick(id: string): void {
    const context = this.store.markedContexts().find((markedContext) => markedContext.id === id);
    if (!context) return;

    const anchor = this.findMarkedContextAnchor(id);
    this.selectionNoteTarget.set({
      messageId: context.messageId,
      selectedText: context.selectedText,
    });
    this.selectionNoteContextId.set(context.id);
    this.selectionMarkNote.set(context.note ?? '');
    this.selectionNoteComposing.set(false);
    this.selectionRequestToken++;
    this.selectionTranslateTarget.set(null);
    this.selectionTooltipVisible.set(false);
    this.selectionTooltipStatus.set('idle');
    this.selectionTooltipText.set('');
    this.selectionTooltipError.set(null);

    if (anchor) {
      anchor.scrollIntoView({ block: 'center' });
      this.updateSelectionNotePosition(anchor.getBoundingClientRect());
    } else {
      this.selectionNotePosition.set(this.selectionActionPosition());
    }
    this.selectionNoteEditorVisible.set(true);
  }

  removeMarkedContext(id: string, event?: Event): void {
    event?.stopPropagation();
    if (this.selectionNoteContextId() === id) {
      this.onSelectionNoteEditorClose();
    }
    this.store.removeMarkedContext(id);
  }

  onSelectionNoteEditorClose(): void {
    this.selectionNoteEditorVisible.set(false);
    this.selectionNoteTarget.set(null);
    this.selectionNoteContextId.set(null);
    this.selectionNoteComposing.set(false);
    this.selectionMarkNote.set('');
    if (typeof window !== 'undefined') window.getSelection()?.removeAllRanges();
  }

  async onSelectionTranslateRetry(): Promise<void> {
    await this.onSelectionTranslateActionClick();
  }

  onSelectionTooltipClose(): void {
    this.dismissSelectionTranslation(true);
  }

  onSelectionOverlayMouseDown(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onSelectionActionPointerDown(event: PointerEvent): void {
    // 避免觸控按下工具列後焦點先移走、清除選取，導致 click 讀不到文字。
    if (this.mobileSelectionEnabled() && event.isPrimary) event.preventDefault();
  }

  onSelectionModalBackdropClick(): void {
    this.dismissSelectionTranslation(true);
  }

  onSelectionContextMenu(event: MouseEvent): void {
    const target = event.target;
    if (!this.mobileSelectionEnabled() || !(target instanceof Element)) return;
    if (target.closest('input, textarea, [contenteditable="true"]')) return;
    const host = this.resolveSelectionHost(target);
    if (host && this.hostElement.nativeElement.contains(host)) event.preventDefault();
  }

  private selectionLayout(host: HTMLElement): SelectionLayout {
    const entries = this.collectSelectionTextNodes(host);
    const fullText = entries.map((entry) => entry.node.data).join('');
    const range = this.createTextRange(entries, 0, fullText.length);
    return {
      entries,
      fullText,
      textRects: mergeSelectionRects(Array.from(range?.getClientRects() ?? [])),
    };
  }

  private cancelSelectionFrame(): void {
    if (this.selectionFrame !== null) window.cancelAnimationFrame(this.selectionFrame);
    this.selectionFrame = null;
  }

  private flushSelectionMove(): void {
    const gesture = this.mobileSelectionGesture;
    if (!gesture?.active || !gesture.pendingPoint) return;
    const finger = gesture.pendingPoint;
    gesture.pendingPoint = undefined;
    const point = snapSelectionPoint(gesture.textRects, {
      x: finger.x - (gesture.shift?.x ?? 0),
      y: finger.y - (gesture.shift?.y ?? 0),
    });
    const caret = this.resolveMobileCaret(gesture.host, point.x, point.y, gesture);
    if (!caret) return;
    gesture.lastOffset =
      gesture.edge === 'start'
        ? Math.min(caret.offset, gesture.startOffset - 1)
        : gesture.edge === 'end'
          ? Math.max(caret.offset, gesture.startOffset + 1)
          : caret.offset;
    if (gesture.word) {
      gesture.startOffset =
        caret.offset < gesture.word.start ? gesture.word.end : gesture.word.start;
      // 手指仍在起始單字內時保留完整單字，避免一開始就縮成半個字。
      if (caret.offset >= gesture.word.start && caret.offset <= gesture.word.end) {
        gesture.lastOffset = gesture.word.end;
      }
    }
    this.updateMobileSelectionDraft(gesture, gesture.startOffset, gesture.lastOffset);
    this.updateSelectionMagnifier(gesture, finger);
  }

  private updateSelectionMagnifier(
    gesture: MobileSelectionGesture,
    finger: { x: number; y: number },
  ): void {
    const handle =
      this.selectionHandles()[
        gesture.edge ?? (gesture.lastOffset < gesture.startOffset ? 'start' : 'end')
      ];
    const isStart =
      gesture.edge === 'start' || (!gesture.edge && gesture.lastOffset < gesture.startOffset);
    const bounds = gesture.host.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportWidth = viewport?.width ?? window.innerWidth;
    this.selectionMagnifier.set({
      source: gesture.host,
      sourceWidth: bounds.width,
      textHeight: handle.height,
      point: {
        x: handle.x - bounds.left,
        y: handle.y + (isStart ? handle.height / 2 : -handle.height / 2) - bounds.top,
      },
      left: Math.max(viewportLeft + 8, Math.min(viewportLeft + viewportWidth - 192, finger.x - 92)),
      top: Math.max(viewportTop + 8, finger.y - 100),
      highlights: this.mobileSelectionRects().map((rect) => ({
        ...rect,
        left: rect.left - bounds.left,
        top: rect.top - bounds.top,
      })),
    });
  }

  onSelectionHandleDown(event: PointerEvent, edge: 'start' | 'end'): void {
    this.selectionTap = null;
    const draft = this.mobileSelectionDraft();
    if (!draft || !event.isPrimary) return;
    const host = Array.from(
      this.hostElement.nativeElement.querySelectorAll<HTMLElement>(
        '[data-speaking-selection-context="review-discussion"]',
      ),
    ).find(
      (candidate) =>
        (candidate.dataset['speakingSelectionMessageId'] ??
          candidate.dataset['speakingAssistantMessageId']) === draft.messageId,
    );
    if (!host) return;
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    this.mobileSelectionGesture = {
      pointerType: event.pointerType,
      edge,
      ...this.selectionLayout(host),
      shift: {
        x: event.clientX - this.selectionHandles()[edge].x,
        y:
          event.clientY -
          (this.selectionHandles()[edge].y +
            ((edge === 'start' ? 1 : -1) * this.selectionHandles()[edge].height) / 2),
      },
      pointerId: event.pointerId,
      host,
      messageId: draft.messageId,
      startOffset: edge === 'start' ? draft.end : draft.start,
      lastOffset: draft[edge],
      startPoint: { x: event.clientX, y: event.clientY },
      active: true,
      longPressTimer: null,
    };
    this.mobileSelectionActive.set(true);
    this.updateSelectionMagnifier(
      this.mobileSelectionGesture,
      this.mobileSelectionGesture.startPoint,
    );
  }

  private startMobileSelection(event: PointerEvent, target: HTMLElement): boolean {
    if (!this.isTouchPointer(event)) return false;
    if (!event.isPrimary) {
      this.cancelMobileSelectionGesture(false);
      return false;
    }
    if (target.closest('.speaking-marked-text')) return false;

    const host = this.resolveSelectionHost(target);
    if (!host || !this.hostElement.nativeElement.contains(host)) return false;

    const messageId =
      host.dataset['speakingSelectionMessageId'] ?? host.dataset['speakingAssistantMessageId'];
    if (!messageId) return false;

    const layout = this.selectionLayout(host);
    const caret = this.resolveMobileCaret(host, event.clientX, event.clientY, layout);
    if (!caret) return false;

    this.cancelMobileSelectionGesture(false);
    const gesture: MobileSelectionGesture = {
      pointerType: event.pointerType,
      ...layout,
      pointerId: event.pointerId,
      host,
      messageId,
      startOffset: caret.offset,
      lastOffset: caret.offset,
      startPoint: { x: event.clientX, y: event.clientY },
      active: false,
      longPressTimer: null,
    };
    this.mobileSelectionGesture = gesture;
    this.mobileSelectionActive.set(false);
    this.selectionMagnifier.set(null);
    gesture.longPressTimer = window.setTimeout(() => {
      if (this.mobileSelectionGesture !== gesture) return;
      this.selectionTap = null;
      this.selectionActionsSuppressed.set(false);
      gesture.active = true;
      this.mobileSelectionActive.set(true);
      gesture.longPressTimer = null;
      window.getSelection()?.removeAllRanges();
      const wordRange = findSelectionWord(gesture.fullText, gesture.startOffset);
      if (wordRange) {
        gesture.word = wordRange;
        gesture.startOffset = wordRange.start;
        gesture.lastOffset = wordRange.end;
        this.updateMobileSelectionDraft(gesture, wordRange.start, wordRange.end);
      } else {
        this.updateMobileSelectionDraft(gesture, gesture.startOffset, gesture.lastOffset);
      }
      this.updateSelectionMagnifier(gesture, gesture.startPoint);
    }, 320);
    return true;
  }

  private trackSelectionTapMovement(x: number, y: number): void {
    const tap = this.selectionTap;
    if (tap && Math.hypot(x - tap.x, y - tap.y) > 10) {
      tap.moved = true;
      this.selectionActionsSuppressed.set(true);
      if (this.mobileSelectionGesture && !this.mobileSelectionGesture.active)
        this.cancelMobileSelectionGesture(false);
    }
  }

  private isPointInMobileSelection(x: number, y: number): boolean {
    return this.mobileSelectionRects().some(
      (rect) =>
        x >= rect.left &&
        x <= rect.left + rect.width &&
        y >= rect.top &&
        y <= rect.top + rect.height,
    );
  }

  private refreshMobileSelection(): void {
    const draft = this.mobileSelectionDraft();
    const source = this.selectionSource;
    if (!draft || !source) return;
    if (!source.host.isConnected) {
      this.dismissSelectionTranslation(false);
      return;
    }
    this.updateMobileSelectionDraft(source, draft.start, draft.end);
  }

  private cancelMobileSelectionGesture(clearSelection: boolean): void {
    this.cancelSelectionFrame();
    const gesture = this.mobileSelectionGesture;
    if (gesture) this.clearMobileSelectionTimer(gesture);
    this.mobileSelectionGesture = null;
    this.mobileSelectionActive.set(false);
    this.selectionMagnifier.set(null);
    if (clearSelection) this.dismissSelectionTranslation(false);
  }

  private clearMobileSelectionTimer(gesture: MobileSelectionGesture): void {
    if (gesture.longPressTimer === null) return;
    window.clearTimeout(gesture.longPressTimer);
    gesture.longPressTimer = null;
  }

  private updateMobileSelectionDraft(
    gesture: Pick<MobileSelectionGesture, 'host' | 'messageId' | 'entries' | 'fullText'>,
    startOffset: number,
    endOffset: number,
  ): void {
    const { entries, fullText } = gesture;
    this.selectionSource = gesture;
    this.selectionDocumentOffset.set({ x: window.scrollX, y: window.scrollY });
    const selectedRange = this.normalizeMobileSelectionRange(fullText, startOffset, endOffset);
    if (!selectedRange) {
      this.mobileSelectionDraft.set(null);
      this.mobileSelectionRects.set([]);
      this.selectionTranslateTarget.set(null);
      return;
    }

    const range = this.createTextRange(entries, selectedRange.start, selectedRange.end);
    if (!range) return;
    const rect = range.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0) return;
    this.mobileSelectionRects.set(mergeSelectionRects(Array.from(range.getClientRects())));

    const firstRange = this.createTextRange(entries, selectedRange.start, selectedRange.start + 1);
    const lastRange = this.createTextRange(entries, selectedRange.end - 1, selectedRange.end);
    if (firstRange && lastRange) {
      const first = firstRange.getBoundingClientRect();
      const last = lastRange.getBoundingClientRect();
      this.selectionHandles.set({
        start: { x: first.left, y: first.top, height: first.height },
        end: { x: last.right, y: last.bottom, height: last.height },
      });
    }
    this.mobileSelectionDraft.set({
      messageId: gesture.messageId,
      start: selectedRange.start,
      end: selectedRange.end,
      selectedText: selectedRange.selectedText,
    });
    this.selectionTranslateTarget.set({
      messageId: gesture.messageId,
      selectedText: selectedRange.selectedText,
    });
    this.updateSelectionActionPosition(rect);
  }

  private normalizeMobileSelectionRange(
    fullText: string,
    startOffset: number,
    endOffset: number,
  ): { start: number; end: number; selectedText: string } | null {
    const start = Math.max(0, Math.min(startOffset, endOffset));
    const end = Math.min(fullText.length, Math.max(startOffset, endOffset));
    const rawText = fullText.slice(start, end);
    const selectedText = rawText.trim();
    if (!selectedText) return null;

    const leadingWhitespace = rawText.indexOf(selectedText);
    return {
      start: start + Math.max(0, leadingWhitespace),
      end: start + Math.max(0, leadingWhitespace) + selectedText.length,
      selectedText,
    };
  }

  private resolveMobileCaret(
    host: HTMLElement,
    x: number,
    y: number,
    layout: SelectionLayout,
  ): { offset: number } | null {
    const documentWithCaret = document as DocumentWithCaretApi;
    let range = documentWithCaret.caretRangeFromPoint?.(x, y) ?? null;
    if (!range && documentWithCaret.caretPositionFromPoint) {
      const position = documentWithCaret.caretPositionFromPoint(x, y);
      if (position) {
        range = document.createRange();
        range.setStart(position.offsetNode, position.offset);
        range.collapse(true);
      }
    }
    if (!range || !host.contains(range.startContainer))
      return this.resolveMeasuredCaret(layout, x, y);
    const entry = layout.entries.find((item) => item.node === range.startContainer);
    if (entry) return { offset: entry.start + range.startOffset };

    const prefix = document.createRange();
    try {
      prefix.selectNodeContents(host);
      prefix.setEnd(range.startContainer, range.startOffset);
    } catch {
      return null;
    }
    return { offset: prefix.toString().length };
  }

  private resolveMeasuredCaret(
    layout: SelectionLayout,
    x: number,
    y: number,
  ): { offset: number } | null {
    // WebKit 的 user-select:none 可能讓 caret API 回傳 null。
    // 字形範圍只量測一次，後續移動使用快取，不切換 CSS 或重排原文。
    if (!layout.glyphs) {
      layout.glyphs = [];
      const segments = new Intl.Segmenter('zh-Hant', { granularity: 'grapheme' }).segment(
        layout.fullText,
      );
      for (const item of segments) {
        const start = item.index;
        const end = start + item.segment.length;
        const range = this.createTextRange(layout.entries, start, end);
        for (const rect of Array.from(range?.getClientRects() ?? [])) {
          if (rect.width <= 0 || rect.height <= 0) continue;
          layout.glyphs.push({
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            start,
            end,
          });
        }
      }
    }
    let best: (typeof layout.glyphs)[number] | undefined;
    let distance = Infinity;
    for (const glyph of layout.glyphs) {
      const score =
        Math.abs(y - glyph.top - glyph.height / 2) * 10000 +
        Math.max(glyph.left - x, x - glyph.left - glyph.width, 0);
      if (score < distance) {
        distance = score;
        best = glyph;
      }
    }
    return best ? { offset: x < best.left + best.width / 2 ? best.start : best.end } : null;
  }

  private createTextRange(
    entries: SelectionTextNodeEntry[],
    start: number,
    end: number,
  ): Range | null {
    const startEntry = entries.find((entry) => start >= entry.start && start < entry.end);
    const endEntry = entries.find((entry) => end > entry.start && end <= entry.end);
    if (!startEntry || !endEntry || end <= start) return null;

    const range = document.createRange();
    range.setStart(startEntry.node, start - startEntry.start);
    range.setEnd(endEntry.node, end - endEntry.start);
    return range;
  }

  private isTouchPointer(event: PointerEvent): boolean {
    return event.pointerType === 'touch' || event.pointerType === 'pen';
  }

  private canUseMobileSelection(): boolean {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    const pointerCoarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const documentWithCaret = document as DocumentWithCaretApi;
    const hasCaretApi =
      typeof documentWithCaret.caretRangeFromPoint === 'function' ||
      typeof documentWithCaret.caretPositionFromPoint === 'function';
    return pointerCoarse && hasCaretApi;
  }

  private resolveSelectionHost(node: Node | null): HTMLElement | null {
    const element = node instanceof Element ? node : node?.parentElement;
    return (
      element?.closest<HTMLElement>(
        '[data-speaking-selection-context="review-discussion"][data-speaking-selection-message-id], ' +
          '[data-speaking-selection-context="review-discussion"][data-speaking-assistant-message-id]',
      ) ?? null
    );
  }

  private updateSelectionActionPosition(
    rect: DOMRect,
    width = this.mobileSelectionEnabled() ? 224 : 124,
    height = this.mobileSelectionEnabled() ? 54 : 44,
  ): void {
    this.selectionActionAnchor = rect;
    const gap = this.mobileSelectionEnabled() ? 26 : 10;
    const safe = 8;
    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportWidth = viewport?.width ?? window.innerWidth;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const headerBottom =
      this.hostElement.nativeElement.querySelector('fm-page-header')?.getBoundingClientRect()
        .bottom ?? 0;
    const minTop = Math.max(viewportTop + safe, headerBottom);
    const desiredTop =
      rect.top - height - gap < minTop ? rect.bottom + gap : rect.top - height - gap;
    const top = Math.max(
      minTop,
      Math.min(desiredTop, viewportTop + viewportHeight - height - safe),
    );
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - width / 2, viewportLeft + safe),
      Math.max(viewportLeft + safe, viewportLeft + viewportWidth - width - safe),
    );
    this.selectionActionPosition.set({ left, top });
  }

  private updateSelectionNotePosition(rect: DOMRect): void {
    const width = 280;
    const height = 44;
    const gap = 10;
    const safe = 8;
    const top = rect.top - height - gap < safe ? rect.bottom + gap : rect.top - height - gap;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - width / 2, safe),
      Math.max(safe, window.innerWidth - width - safe),
    );
    this.selectionNotePosition.set({ left, top });
  }

  private updateMarkedContextEditorPosition(): void {
    const id = this.selectionNoteContextId();
    if (!id) return;
    const anchor = this.findMarkedContextAnchor(id);
    if (!anchor) return;
    this.updateSelectionNotePosition(anchor.getBoundingClientRect());
  }

  private findMarkedContextAnchor(id: string): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    const anchors = this.hostElement.nativeElement.querySelectorAll<HTMLElement>(
      '[data-speaking-marked-context-id]',
    );
    return (
      Array.from(anchors).find((anchor) => anchor.dataset['speakingMarkedContextId'] === id) ?? null
    );
  }

  private decorateMarkedSelections(contexts: readonly SpeakingReviewMarkedContext[]): void {
    if (typeof document === 'undefined') return;

    const root = this.hostElement.nativeElement;
    this.clearMarkedSelections(root);
    if (contexts.length === 0) return;

    const contextsByMessageId = new Map<string, SpeakingReviewMarkedContext[]>();
    contexts.forEach((context) => {
      const current = contextsByMessageId.get(context.messageId) ?? [];
      contextsByMessageId.set(context.messageId, [...current, context]);
    });

    const hosts = root.querySelectorAll<HTMLElement>(
      '[data-speaking-selection-context="review-discussion"][data-speaking-selection-message-id], ' +
        '[data-speaking-selection-context="review-discussion"][data-speaking-assistant-message-id]',
    );
    hosts.forEach((host) => {
      const messageId =
        host.dataset['speakingSelectionMessageId'] ?? host.dataset['speakingAssistantMessageId'];
      if (!messageId) return;

      const entries = this.collectSelectionTextNodes(host);
      const fullText = entries.map((entry) => entry.node.data).join('');
      const matches = (contextsByMessageId.get(messageId) ?? [])
        .map((context) => ({
          context,
          number: contexts.findIndex((candidate) => candidate.id === context.id) + 1,
          range: this.findSelectionTextRange(fullText, context.selectedText.trim()),
        }))
        .filter(
          (
            match,
          ): match is {
            context: SpeakingReviewMarkedContext;
            number: number;
            range: { start: number; end: number };
          } => match.range !== null,
        )
        .sort((left, right) => right.range.start - left.range.start);

      const occupiedRanges: { start: number; end: number }[] = [];
      for (const match of matches) {
        if (occupiedRanges.some((occupied) => this.rangesOverlap(occupied, match.range))) {
          continue;
        }
        this.highlightMarkedSelection(entries, match.context, match.number, match.range);
        occupiedRanges.push(match.range);
      }
    });
  }

  private clearMarkedSelections(root: HTMLElement): void {
    const marks = Array.from(
      root.querySelectorAll<HTMLElement>('.speaking-marked-text[data-speaking-marked-context-id]'),
    ).reverse();
    for (const mark of marks) {
      const parent = mark.parentNode;
      if (!parent) continue;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      mark.remove();
    }
    root.normalize();
  }

  private highlightMarkedSelection(
    entries: SelectionTextNodeEntry[],
    context: SpeakingReviewMarkedContext,
    number: number,
    matchRange: { start: number; end: number },
  ): void {
    const overlappingEntries = entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.end > matchRange.start && entry.start < matchRange.end);
    if (overlappingEntries.length === 0) return;
    const firstEntryIndex = overlappingEntries[0].index;

    for (let index = overlappingEntries.length - 1; index >= 0; index -= 1) {
      const { entry, index: entryIndex } = overlappingEntries[index];
      const segmentStart = Math.max(matchRange.start, entry.start) - entry.start;
      const segmentEnd = Math.min(matchRange.end, entry.end) - entry.start;
      if (segmentEnd <= segmentStart) continue;

      const mark = document.createElement('span');
      mark.className = 'speaking-marked-text';
      mark.dataset['speakingMarkedContextId'] = context.id;
      mark.dataset['speakingMarkedContextNumber'] = String(number);
      if (entryIndex === firstEntryIndex) {
        mark.dataset['speakingMarkedContextAnchor'] = 'true';
        mark.setAttribute('role', 'button');
        mark.setAttribute('tabindex', '0');
        mark.setAttribute('aria-label', `編輯註解 ${number}`);
        mark.setAttribute('title', `註解 ${number}：點擊編輯`);
        mark.dataset['testid'] = `speaking-marked-context-${context.id}`;
      }

      const selectionRange = document.createRange();
      selectionRange.setStart(entry.node, segmentStart);
      selectionRange.setEnd(entry.node, segmentEnd);
      mark.appendChild(selectionRange.extractContents());
      selectionRange.insertNode(mark);
    }
  }

  private collectSelectionTextNodes(host: HTMLElement): SelectionTextNodeEntry[] {
    const entries: SelectionTextNodeEntry[] = [];
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    let start = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (!node.data) continue;
      const end = start + node.data.length;
      entries.push({ node, start, end });
      start = end;
    }
    return entries;
  }

  private rangesOverlap(
    left: { start: number; end: number },
    right: { start: number; end: number },
  ): boolean {
    return left.start < right.end && right.start < left.end;
  }

  private findSelectionTextRange(
    fullText: string,
    selectedText: string,
  ): { start: number; end: number } | null {
    const exactStart = fullText.indexOf(selectedText);
    if (exactStart >= 0) {
      return { start: exactStart, end: exactStart + selectedText.length };
    }

    const normalizedSelectedText = selectedText.replace(/\s+/g, ' ').trim();
    if (!normalizedSelectedText) return null;
    const normalizedFullText = this.normalizeSelectionText(fullText);
    const normalizedStart = normalizedFullText.text.indexOf(normalizedSelectedText);
    if (normalizedStart < 0) return null;

    const rawStart = normalizedFullText.rawIndices[normalizedStart];
    const rawEndIndex = normalizedStart + normalizedSelectedText.length - 1;
    const rawEnd = normalizedFullText.rawIndices[rawEndIndex];
    if (rawStart === undefined || rawEnd === undefined) return null;
    return { start: rawStart, end: rawEnd + 1 };
  }

  private normalizeSelectionText(value: string): { text: string; rawIndices: number[] } {
    let text = '';
    const rawIndices: number[] = [];
    let pendingSpace = false;

    for (let index = 0; index < value.length; index += 1) {
      if (/\s/.test(value[index])) {
        if (text && !pendingSpace) {
          text += ' ';
          rawIndices.push(index);
        }
        pendingSpace = true;
        continue;
      }
      text += value[index];
      rawIndices.push(index);
      pendingSpace = false;
    }

    if (text.endsWith(' ')) {
      text = text.slice(0, -1);
      rawIndices.pop();
    }
    return { text, rawIndices };
  }

  private dismissSelectionTranslation(clearNativeSelection: boolean): void {
    this.selectionSource = null;
    this.selectionTap = null;
    this.selectionActionsSuppressed.set(false);
    this.mobileSelectionRects.set([]);
    this.selectionSpeechError.set(null);
    this.selectionRequestToken++;
    this.mobileSelectionDraft.set(null);
    this.selectionTranslateTarget.set(null);
    this.selectionTooltipVisible.set(false);
    this.selectionTooltipStatus.set('idle');
    this.selectionTooltipText.set('');
    this.selectionTooltipError.set(null);

    if (clearNativeSelection && typeof window !== 'undefined') {
      window.getSelection()?.removeAllRanges();
    }
  }
}
