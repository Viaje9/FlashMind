import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  COLLECTION_KIND_LABEL,
  type CollectionBreakdownItem,
  type CollectionItem,
  buildHighlightedSentence,
} from './collection-pack.domain';

@Component({
  selector: 'app-collection-item-card',
  template: `
    <article class="rounded-2xl border border-slate-700 bg-surface-dark p-4 shadow-sm">
      <div class="space-y-2">
        @if (item().kind === 'sentence') {
          <p class="text-base font-bold leading-relaxed text-white">
            @for (token of highlightedTokens(); track $index) {
              <span
                [class.rounded-md]="token.kind"
                [class.px-1]="token.kind"
                [class.py-0.5]="token.kind"
                [class.bg-cyan-500/15]="token.kind === 'collocation'"
                [class.text-cyan-100]="token.kind === 'collocation'"
                [class.bg-emerald-500/15]="token.kind === 'phrase'"
                [class.text-emerald-100]="token.kind === 'phrase'"
                [class.bg-violet-500/20]="token.kind === 'clause'"
                [class.text-violet-100]="token.kind === 'clause'"
                >{{ token.text }}</span
              >
            }
          </p>
        } @else {
          <p class="text-base font-bold leading-relaxed text-white">
            {{ item().text }}
          </p>
        }

        <p class="text-sm font-medium leading-relaxed text-slate-300">
          {{ item().meaning }}
        </p>

        <div class="flex flex-wrap gap-2">
          <span [class]="kindPillClass(item().kind)">
            {{ kindLabel(item().kind) }}
          </span>
          @if (item().kind === 'collocation') {
            @for (word of item().sourceWords; track word) {
              <span
                class="rounded-full bg-slate-700/70 px-2.5 py-1 text-xs font-bold text-slate-300"
              >
                {{ word }}
              </span>
            }
          }
        </div>
      </div>

      @if (item().kind === 'sentence' && item().breakdownItems.length) {
        <section class="mt-4 space-y-2">
          <h3 class="text-xs font-bold text-secondary-text">AI 拆解</h3>
          @for (chunk of item().breakdownItems; track chunk.id) {
            <div class="rounded-xl border border-slate-600 bg-card-dark p-3">
              <p class="text-sm font-bold text-white">{{ chunk.text }}</p>
              <p class="mt-1 text-xs font-medium text-slate-300">{{ chunk.meaning }}</p>
              <div class="mt-2 flex flex-wrap gap-2">
                <span [class]="kindPillClass(chunk.kind)">
                  {{ kindLabel(chunk.kind) }}
                </span>
                @if (chunk.sourceWord) {
                  <span
                    class="rounded-full bg-slate-700/70 px-2.5 py-1 text-xs font-bold text-slate-300"
                  >
                    {{ chunk.sourceWord }}
                  </span>
                }
              </div>
            </div>
          }
        </section>
      }

      @if (item().kind === 'collocation' && item().relatedChunks.length) {
        <section class="mt-4 space-y-2">
          <h3 class="text-xs font-bold text-secondary-text">關聯片語 / 子句</h3>
          @for (chunk of item().relatedChunks; track chunk.id) {
            <ng-container
              [ngTemplateOutlet]="chunkCard"
              [ngTemplateOutletContext]="{ chunk: chunk }"
            ></ng-container>
          }
        </section>
      }

      @if ((item().kind === 'phrase' || item().kind === 'clause') && item().relatedChunks.length) {
        <section class="mt-4 space-y-2">
          <h3 class="text-xs font-bold text-secondary-text">關聯搭配詞</h3>
          @for (chunk of item().relatedChunks; track chunk.id) {
            <ng-container
              [ngTemplateOutlet]="chunkCard"
              [ngTemplateOutletContext]="{ chunk: chunk }"
            ></ng-container>
          }
        </section>
      }

      @if (
        (item().kind === 'phrase' || item().kind === 'clause') && item().relatedSentences.length
      ) {
        <section class="mt-4 space-y-2">
          <h3 class="text-xs font-bold text-secondary-text">關聯句子</h3>
          @for (sentence of item().relatedSentences; track sentence.id) {
            <div class="rounded-xl border border-slate-600 bg-card-dark p-3">
              <p class="text-sm font-bold text-white">{{ sentence.text }}</p>
              <p class="mt-1 text-xs font-medium text-slate-300">{{ sentence.meaning }}</p>
            </div>
          }
        </section>
      }
    </article>

    <ng-template #chunkCard let-chunk="chunk">
      <div class="rounded-xl border border-slate-600 bg-card-dark p-3">
        <p class="text-sm font-bold text-white">{{ chunk.text }}</p>
        <p class="mt-1 text-xs font-medium text-slate-300">{{ chunk.meaning }}</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <span [class]="kindPillClass(chunk.kind)">
            {{ kindLabel(chunk.kind) }}
          </span>
        </div>
      </div>
    </ng-template>
  `,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionItemCardComponent {
  readonly item = input.required<CollectionItem>();

  readonly highlightedTokens = computed(() =>
    this.item().kind === 'sentence'
      ? buildHighlightedSentence(this.item().text, this.item().breakdownItems)
      : [{ text: this.item().text }],
  );

  kindLabel(kind: CollectionItem['kind'] | CollectionBreakdownItem['kind']): string {
    return COLLECTION_KIND_LABEL[kind];
  }

  kindPillClass(kind: CollectionItem['kind'] | CollectionBreakdownItem['kind']): string {
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
