import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'fm-toggle',
  templateUrl: './toggle.component.html',
  styleUrl: './toggle.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmToggleComponent {
  readonly checked = input(false);
  readonly disabled = input(false);
  readonly ariaLabel = input('');
  readonly changed = output<boolean>();

  readonly ariaLabelValue = computed(() => this.ariaLabel() || null);

  onToggle(event: Event) {
    const inputElement = event.target as HTMLInputElement | null;
    if (!inputElement) {
      return;
    }
    this.changed.emit(inputElement.checked);
  }
}
