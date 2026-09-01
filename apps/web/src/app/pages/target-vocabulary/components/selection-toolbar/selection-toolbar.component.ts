import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FmButtonComponent } from '@flashmind/ui';
import { SelectionCheckComponent } from '../selection-check/selection-check.component';

@Component({
  selector: 'app-target-vocabulary-selection-toolbar',
  imports: [FmButtonComponent, SelectionCheckComponent],
  template: `
    <div
      class="mt-3 flex items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-300"
    >
      <app-target-vocabulary-selection-check
        [checked]="selectedCount() === total() && total() > 0"
        [indeterminate]="selectedCount() > 0 && selectedCount() < total()"
        ariaLabel="全選目前顯示的目標單字"
        testId="target-vocabulary-select-all"
        (changed)="toggleAll.emit()"
      >
        全選目前 {{ total() }} 個
      </app-target-vocabulary-selection-check>
      <span class="text-xs text-slate-500 dark:text-slate-400">勾選後一起加入</span>
    </div>
    @if (selectedCount()) {
      <div class="selection-dock" role="region" aria-label="已勾選單字的批次操作">
        <div class="flex min-w-0 items-center gap-2">
          <span class="count">{{ selectedCount() }}</span>
          <span class="text-sm font-bold">個已選</span>
        </div>
        <div class="flex gap-1">
          <fm-button
            variant="ghost"
            size="sm"
            (click)="clear.emit()"
            testId="target-vocabulary-selection-clear"
            >清除</fm-button
          >
          <fm-button size="sm" (click)="add.emit()" testId="target-vocabulary-batch-add"
            >一起加入牌組</fm-button
          >
        </div>
      </div>
    }
  `,
  styles: `
    .selection-dock {
      position: fixed;
      z-index: 20;
      bottom: max(1rem, env(safe-area-inset-bottom));
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      width: min(calc(100% - 2rem), 26rem);
      padding: 0.8rem;
      border: 1px solid #bae6fd;
      border-radius: 1.15rem;
      background: #f8fafc;
      color: #0f172a;
      box-shadow: 0 12px 36px rgb(2 8 23 / 0.24);
    }
    .count {
      display: grid;
      place-items: center;
      min-width: 1.75rem;
      height: 1.75rem;
      border-radius: 0.55rem;
      background: #e0f2fe;
      color: #0369a1;
      font-weight: 800;
      font-size: 0.85rem;
    }
    @media (prefers-color-scheme: dark) {
      .selection-dock {
        background: #10212c;
        color: #f1f5f9;
        border-color: #28536a;
      }
      .count {
        background: #153b51;
        color: #7dd3fc;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectionToolbarComponent {
  readonly selectedCount = input.required<number>();
  readonly total = input.required<number>();
  readonly toggleAll = output<void>();
  readonly clear = output<void>();
  readonly add = output<void>();
}
