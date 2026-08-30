import { ChangeDetectionStrategy, Component, OnInit, inject, output } from '@angular/core';
import { FmButtonComponent } from '@flashmind/ui';
import { SpeakingMigrationStore } from './speaking-migration.store';

@Component({
  selector: 'app-speaking-history-migration',
  imports: [FmButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.entries().length) {
      <section
        class="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-slate-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-slate-200"
        data-testid="speaking-migration"
      >
        <div class="flex items-center justify-between gap-3">
          <h2 class="min-w-0 font-semibold">
            @if (store.collapsed()) {
              {{ store.entries().length }} 筆舊口說紀錄尚未搬移
            } @else {
              搬移這台裝置的舊口說紀錄
            }
          </h2>
          <button
            type="button"
            class="min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium underline underline-offset-4 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:opacity-50 dark:hover:bg-amber-900/40 dark:focus-visible:outline-amber-400"
            data-testid="speaking-migration-toggle"
            [disabled]="store.busy()"
            [attr.aria-expanded]="!store.collapsed()"
            aria-controls="speaking-migration-details"
            (click)="store.setCollapsed(!store.collapsed())"
          >
            {{ store.collapsed() ? '展開搬移' : '稍後再處理' }}
          </button>
        </div>
        <div id="speaking-migration-details" [hidden]="store.collapsed()">
          <p class="my-2 text-sm">
            只需選取想保留在帳號中的紀錄，不必全部搬移。稍後再處理不會刪除任何資料。
          </p>
          <p class="mb-3 text-sm">只上傳文字及既有摘要，原始音訊和備份留在本機，單字次數不變。</p>
          <div
            class="max-h-64 overflow-y-auto overscroll-contain rounded-lg border border-amber-200 p-3 dark:border-amber-800/60"
          >
            @for (entry of store.entries(); track entry.id) {
              <label class="my-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  data-testid="speaking-migration-select"
                  [checked]="store.selected().includes(entry.id)"
                  [disabled]="store.busy()"
                  (change)="store.toggle(entry.id)"
                />
                <span>{{ entry.title }}</span>
              </label>
            }
          </div>
          <label class="my-4 flex items-center gap-2">
            <input
              type="checkbox"
              data-testid="speaking-migration-confirm"
              [checked]="store.confirmed()"
              [disabled]="store.busy()"
              (change)="confirm($event)"
            />
            <span>我確認這些紀錄屬於 {{ store.user()?.email }}，並同意搬移文字。</span>
          </label>
          <fm-button
            testId="speaking-migration-start"
            [disabled]="store.busy() || !store.confirmed() || !store.selected().length"
            (click)="migrate()"
            >{{ store.busy() ? '搬移中…' : '搬移選取紀錄／重試' }}</fm-button
          >
          <div aria-live="polite">
            @for (result of store.results(); track result.clientSessionId) {
              <p class="mt-2 text-sm" data-testid="speaking-migration-result">
                {{ label(result.status) }}{{ result.message ? '：' + result.message : '' }}
              </p>
            }
            @if (store.error()) {
              <p role="alert">{{ store.error() }}</p>
            }
          </div>
        </div>
      </section>
    }
  `,
})
export class SpeakingHistoryMigrationComponent implements OnInit {
  readonly store = inject(SpeakingMigrationStore);
  readonly completed = output<void>();
  ngOnInit() {
    void this.store.scan();
  }
  confirm(event: Event) {
    this.store.confirmOwner((event.target as HTMLInputElement).checked);
  }
  async migrate() {
    await this.store.migrate();
    this.completed.emit();
  }
  label(status: string) {
    return (
      (
        {
          imported: '已搬移',
          alreadyImported: '之前已搬移',
          conflict: '內容衝突，未覆寫',
          failed: '未完成，可重試',
        } as Record<string, string>
      )[status] ?? status
    );
  }
}
