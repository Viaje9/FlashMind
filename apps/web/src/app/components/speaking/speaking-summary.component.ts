import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  input,
  output,
} from '@angular/core';
import { marked, Renderer, type Token } from 'marked';

const renderer = new Renderer();
// Review 只需要文字；原始 HTML 與圖片不得變成可執行內容或連外資源。
renderer.html = ({ text }) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
renderer.image = () => '';
renderer.link = function ({ tokens }) {
  return this.parser.parseInline(tokens);
};
renderer.table = function (token) {
  const table = Renderer.prototype.table.call(this, token);
  return `<div class="speaking-summary-table-scroll" tabindex="0" role="region" aria-label="單字表格，可左右捲動">${table}</div>`;
};

@Component({
  selector: 'app-speaking-summary',
  template: `
    <article
      class="mb-4 min-w-0 border-t-2 border-orange-400"
      [class.speaking-summary-flat]="flat()"
      data-testid="speaking-summary-card"
    >
      <div class="py-5 sm:py-6">
        <header class="mb-4 flex items-center justify-between gap-3">
          <h2 class="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            口說練習回顧
          </h2>
          @if (showCopy()) {
            <button
              type="button"
              class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 hover:bg-orange-50 dark:border-white/10 dark:hover:bg-orange-500/10"
              [class.text-orange-600]="!copied()"
              [class.text-emerald-600]="copied()"
              [attr.aria-label]="copied() ? '摘要已複製' : '複製摘要'"
              (click)="copyRequested.emit()"
              data-testid="speaking-summary-copy"
            >
              <span class="material-symbols-outlined text-[18px]">{{
                copied() ? 'check' : 'content_copy'
              }}</span>
            </button>
          }
        </header>
        <div
          class="speaking-summary-content relative"
          data-testid="speaking-summary-content"
          [attr.data-speaking-selection-context]="selectionMessageId() ? 'review-discussion' : null"
          [attr.data-speaking-selection-message-id]="selectionMessageId()"
        >
          @for (section of sections(); track $index) {
            @if (section.headingHtml) {
              <details
                class="speaking-summary-section"
                [open]="!initiallyCollapsed()"
                [attr.data-testid]="'speaking-summary-section-' + $index"
              >
                <summary [attr.data-testid]="'speaking-summary-toggle-' + $index">
                  <span
                    class="speaking-summary-section-title"
                    [innerHTML]="section.headingHtml"
                  ></span>
                  <span
                    class="material-symbols-outlined speaking-summary-chevron"
                    aria-hidden="true"
                    >expand_more</span
                  >
                </summary>
                <div [innerHTML]="section.bodyHtml"></div>
              </details>
            } @else {
              <div [innerHTML]="section.bodyHtml"></div>
            }
          }
        </div>
      </div>
    </article>
  `,
  styleUrl: './speaking-summary.component.css',
  // innerHTML 不帶 Angular scope attribute；所有樣式限定於本元件 class。
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpeakingSummaryComponent {
  readonly content = input.required<string>();
  readonly copied = input(false);
  readonly showCopy = input(true);
  readonly initiallyCollapsed = input(false);
  readonly flat = input(false);
  readonly selectionMessageId = input<string | null>(null);
  readonly copyRequested = output<void>();
  // 不使用 bypassSecurityTrustHtml，交由 Angular 再做 HTML sanitization。
  readonly sections = computed(() => {
    const blocks: { heading: Token | null; body: Token[] }[] = [{ heading: null, body: [] }];
    // 依 Markdown 的第二層標題分區，保留表格、引言與標題前的舊版摘要。
    for (const token of marked.lexer(this.content(), { gfm: true })) {
      if (token.type === 'heading' && token.depth === 2) {
        blocks.push({ heading: token, body: [] });
      } else {
        blocks[blocks.length - 1].body.push(token);
      }
    }
    return blocks
      .filter((block) => block.heading || block.body.some((token) => token.type !== 'space'))
      .map((block) => ({
        headingHtml: block.heading ? marked.parser([block.heading], { renderer }) : null,
        bodyHtml: marked.parser(block.body, { renderer }),
      }));
  });
}
