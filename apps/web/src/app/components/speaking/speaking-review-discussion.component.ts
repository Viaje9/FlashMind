import {
  ChangeDetectionStrategy,
  Component,
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

@Component({
  selector: 'app-speaking-review-discussion',
  imports: [
    FmButtonComponent,
    FmIconButtonComponent,
    FmPageHeaderComponent,
    SpeakingSummaryComponent,
    TopicConversationComposerComponent,
    TopicConversationMessageComponent,
  ],
  providers: [SpeakingReviewDiscussionStore],
  styleUrl: './speaking-review-discussion.component.css',
  template: `
    <div class="flex min-h-dvh flex-col" data-testid="speaking-review-discussion">
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
        @if (selectionActionVisible()) {
          <div
            class="selection-actions"
            role="toolbar"
            aria-label="選取文字操作"
            data-speaking-selection-overlay="true"
            [style.z-index]="70"
            [style.left.px]="selectionActionPosition().left"
            [style.top.px]="selectionActionPosition().top"
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
            </button>
          </div>
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
  readonly selectionTranslateTarget = signal<SelectionTranslateTarget | null>(null);
  readonly selectionActionPosition = signal({ left: 0, top: 0 });
  readonly selectionTooltipStatus = signal<SelectionTooltipStatus>('idle');
  readonly selectionTooltipVisible = signal(false);
  readonly selectionTooltipText = signal('');
  readonly selectionTooltipError = signal<string | null>(null);
  readonly selectionNoteTarget = signal<SelectionTranslateTarget | null>(null);
  readonly selectionNoteEditorVisible = signal(false);
  readonly selectionNotePosition = signal({ left: 0, top: 0 });
  readonly selectionNoteComposing = signal(false);
  readonly selectionMarkNote = signal('');
  readonly selectionNoteContextId = signal<string | null>(null);
  readonly selectionActionVisible = computed(() => !!this.selectionTranslateTarget()?.selectedText);
  private selectionRequestToken = 0;
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
  private readonly focusSelectionNoteInput = afterRenderEffect(() => {
    if (this.selectionNoteEditorVisible()) {
      this.selectionNoteInput()?.nativeElement.focus();
    }
  });

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

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      this.dismissSelectionTranslation(false);
      return;
    }

    const selectedText = selection.toString().trim();
    const anchor = this.resolveSelectionHost(selection.anchorNode);
    const focus = this.resolveSelectionHost(selection.focusNode);
    if (!selectedText || !anchor || anchor !== focus) {
      this.dismissSelectionTranslation(false);
      return;
    }

    const messageId =
      anchor.dataset['speakingSelectionMessageId'] ?? anchor.dataset['speakingAssistantMessageId'];
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (!messageId || (rect.width <= 0 && rect.height <= 0)) return;

    const current = this.selectionTranslateTarget();
    if (current?.messageId !== messageId || current.selectedText !== selectedText) {
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
    if (target.closest('[data-speaking-selection-context="review-discussion"]')) return;
    this.dismissSelectionTranslation(false);
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
    if (this.selectionNoteEditorVisible()) {
      if (this.selectionNoteContextId()) {
        this.updateMarkedContextEditorPosition();
      } else {
        this.onSelectionNoteEditorClose();
      }
    }
    this.dismissSelectionTranslation(false);
  }

  @HostListener('window:blur')
  onWindowBlur(): void {
    this.dismissSelectionTranslation(true);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
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

  onSelectionModalBackdropClick(): void {
    this.dismissSelectionTranslation(true);
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

  private updateSelectionActionPosition(rect: DOMRect): void {
    const width = 88;
    const height = 44;
    const gap = 10;
    const safe = 8;
    const top = rect.top - height - gap < safe ? rect.bottom + gap : rect.top - height - gap;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - width / 2, safe),
      Math.max(safe, window.innerWidth - width - safe),
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
    this.selectionRequestToken++;
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
