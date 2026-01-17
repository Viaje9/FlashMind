import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FmToggleComponent } from '../../primitives/toggle/toggle.component';

type SettingRowVariant = 'toggle' | 'link' | 'action';

@Component({
  selector: 'fm-setting-row',
  imports: [FmToggleComponent],
  templateUrl: './setting-row.component.html',
  styleUrl: './setting-row.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmSettingRowComponent {
  readonly icon = input('');
  readonly iconClass = input('bg-slate-500/10 text-slate-500');
  readonly label = input('');
  readonly description = input('');
  readonly value = input('');
  readonly variant = input<SettingRowVariant>('toggle');
  readonly checked = input(false);
  readonly disabled = input(false);

  readonly toggleChange = output<boolean>();
  readonly rowClick = output<void>();

  readonly iconContainerClass = computed(() => {
    const base = 'flex items-center justify-center w-8 h-8 rounded-lg';
    return [base, this.iconClass()].filter(Boolean).join(' ');
  });

  readonly rowClass = computed(() => {
    const base = 'flex items-center justify-between p-4 min-h-[56px]';
    const interactive = this.variant() === 'toggle' ? '' : 'hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors';
    return [base, interactive].filter(Boolean).join(' ');
  });

  readonly rowRole = computed(() => (this.variant() === 'toggle' ? null : 'button'));
  readonly rowTabIndex = computed(() => (this.variant() === 'toggle' ? null : 0));

  onToggleChange(nextValue: boolean) {
    this.toggleChange.emit(nextValue);
  }

  onRowClick() {
    if (this.variant() === 'toggle') {
      return;
    }
    this.rowClick.emit();
  }

  onRowKeydown(event: KeyboardEvent) {
    if (this.variant() === 'toggle') {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.rowClick.emit();
    }
  }
}
