import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  input,
  output,
} from '@angular/core';
import { marked, Renderer } from 'marked';

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
      class="mb-4 min-w-0 overflow-hidden rounded-2xl border border-slate-200 border-t-4 border-t-orange-500 bg-white shadow-sm dark:border-white/10 dark:border-t-orange-500 dark:bg-slate-900"
      data-testid="speaking-summary-card"
    >
      <div class="px-4 py-5 sm:px-7 sm:py-6">
        <header class="mb-6 flex items-center justify-between gap-3">
          <div>
            <p
              class="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-600 dark:text-orange-300"
            >
              Speaking Review
            </p>
            <h2 class="mt-1 text-lg font-bold text-slate-900 dark:text-white">口說練習回顧</h2>
          </div>
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
          class="speaking-summary-content"
          data-testid="speaking-summary-content"
          [innerHTML]="html()"
        ></div>
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
  readonly copyRequested = output<void>();
  // 不使用 bypassSecurityTrustHtml，交由 Angular 再做 HTML sanitization。
  readonly html = computed(() =>
    marked.parse(this.content(), { async: false, gfm: true, renderer }),
  );
}
