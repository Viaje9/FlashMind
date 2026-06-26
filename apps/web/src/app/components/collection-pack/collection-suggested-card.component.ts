import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { type CollectionSuggestedCard } from './collection-pack.domain';

@Component({
  selector: 'app-collection-suggested-card',
  host: {
    class: 'block',
  },
  template: `
    <article
      class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-400/25 dark:bg-amber-950/20"
      [class.border-emerald-400/30]="suggestedCard().status === 'added'"
      [class.bg-emerald-500/10]="suggestedCard().status === 'added'"
    >
      <div class="min-w-0">
        <p class="text-sm font-bold leading-relaxed text-slate-900 dark:text-white">
          {{ suggestedCard().front }}
        </p>
        <p class="mt-1 text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-300">
          {{ suggestedCard().meanings[0].zhMeaning }}
        </p>
        <p class="mt-2 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
          {{ suggestedCard().reason }}
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <span
            class="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-200"
          >
            建議單字
          </span>
          @if (suggestedCard().status === 'existing') {
            <span
              class="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-200"
            >
              已有單字卡
            </span>
          } @else if (suggestedCard().status === 'added') {
            <span
              class="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-200"
            >
              已加入{{ suggestedCard().deckName ? ' ' + suggestedCard().deckName : '' }}
            </span>
          } @else if (suggestedCard().status === 'error') {
            <span
              class="rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-bold text-red-700 dark:text-red-200"
            >
              新增失敗
            </span>
          } @else {
            <span
              class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-700/70 dark:text-slate-300"
            >
              將新增
            </span>
          }
        </div>
      </div>

      @if (suggestedCard().status !== 'existing' && suggestedCard().status !== 'added') {
        <button
          type="button"
          class="grid size-10 place-items-center rounded-xl bg-amber-500/15 text-xl font-black text-amber-700 transition hover:bg-amber-300 hover:text-background-dark disabled:opacity-60 dark:text-amber-200"
          [disabled]="suggestedCard().status === 'adding'"
          [attr.aria-label]="'新增單字卡 ' + suggestedCard().front"
          [attr.data-testid]="'suggested-card-add-' + suggestedCard().id"
          (click)="suggestedCardAdd.emit(suggestedCard())"
        >
          @if (suggestedCard().status === 'adding') {
            <span class="material-symbols-outlined animate-spin text-[20px]"
              >progress_activity</span
            >
          } @else {
            +
          }
        </button>
      }
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionSuggestedCardComponent {
  readonly suggestedCard = input.required<CollectionSuggestedCard>();
  readonly suggestedCardAdd = output<CollectionSuggestedCard>();
}
