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
        <h2 class="font-semibold">搬移這台裝置的舊口說紀錄</h2>
        <p class="my-2 text-sm">
          只上傳文字及既有摘要，原始音訊和備份留在本機。搬移不會重新計算單字次數。
        </p>
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
