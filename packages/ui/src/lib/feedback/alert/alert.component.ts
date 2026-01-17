import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type AlertType = 'error' | 'warning' | 'info' | 'success';

@Component({
  selector: 'fm-alert',
  templateUrl: './alert.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmAlertComponent {
  readonly message = input.required<string>();
  readonly type = input<AlertType>('error');

  readonly containerClass = computed(() => {
    const base = 'mb-6 rounded-xl border p-4';
    const typeStyles: Record<AlertType, string> = {
      error: 'bg-red-500/10 border-red-500/20',
      warning: 'bg-amber-500/10 border-amber-500/20',
      info: 'bg-blue-500/10 border-blue-500/20',
      success: 'bg-green-500/10 border-green-500/20'
    };
    return `${base} ${typeStyles[this.type()]}`;
  });

  readonly textClass = computed(() => {
    const base = 'text-sm font-medium';
    const typeStyles: Record<AlertType, string> = {
      error: 'text-red-400',
      warning: 'text-amber-400',
      info: 'text-blue-400',
      success: 'text-green-400'
    };
    return `${base} ${typeStyles[this.type()]}`;
  });
}
