import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { COLLECTION_KIND_LABEL, type CollectionSuggestion } from './collection-pack.domain';

@Component({
  selector: 'app-collection-suggestion-card',
  template: `
    <article
      class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-slate-700 bg-surface-dark p-4 shadow-sm"
      [class.bg-emerald-500/10]="suggestion().added"
      [class.border-emerald-400/30]="suggestion().added"
    >
      <div class="min-w-0">
        <p class="text-sm font-bold leading-relaxed text-white">
          {{ suggestion().text }}
        </p>
        <p class="mt-1 text-xs font-medium leading-relaxed text-slate-300">
          {{ suggestion().meaning }}
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <span [class]="kindPillClass(suggestion().kind)">
            {{ kindLabel(suggestion().kind) }}
          </span>
          @if (suggestion().existing) {
            <span
              class="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-200"
            >
              已在收藏包
            </span>
          } @else if (suggestion().added) {
            <span
              class="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-200"
            >
              已加入
            </span>
          } @else {
            <span class="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-200">
              將新增
            </span>
          }
          @if (suggestion().sourceWord) {
            <span class="rounded-full bg-slate-700/70 px-2.5 py-1 text-xs font-bold text-slate-300">
              {{ suggestion().sourceWord }}
            </span>
          }
        </div>
      </div>

      @if (!suggestion().existing) {
        <button
          type="button"
          class="grid size-10 place-items-center rounded-xl bg-primary/15 text-xl font-black text-primary transition hover:bg-primary hover:text-background-dark"
          [attr.aria-label]="suggestion().added ? '移除收藏' : '加入收藏'"
          [attr.data-testid]="'suggestion-toggle-' + suggestion().id"
          (click)="suggestionToggle.emit(suggestion())"
        >
          {{ suggestion().added ? '−' : '+' }}
        </button>
      }
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionSuggestionCardComponent {
  readonly suggestion = input.required<CollectionSuggestion>();
  readonly suggestionToggle = output<CollectionSuggestion>();

  kindLabel(kind: CollectionSuggestion['kind']): string {
    return COLLECTION_KIND_LABEL[kind];
  }

  kindPillClass(kind: CollectionSuggestion['kind']): string {
    const base = 'rounded-full px-2.5 py-1 text-xs font-bold';
    const tone = {
      sentence: 'bg-slate-700/70 text-slate-200',
      collocation: 'bg-cyan-500/15 text-cyan-200',
      phrase: 'bg-emerald-500/15 text-emerald-200',
      clause: 'bg-violet-500/20 text-violet-200',
    }[kind];

    return `${base} ${tone}`;
  }
}
