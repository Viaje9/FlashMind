import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'fm-form-section-header',
  templateUrl: './form-section-header.component.html',
  styleUrl: './form-section-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmFormSectionHeaderComponent {
  readonly title = input('');
  readonly icon = input('');
  readonly testId = input<string>();
}
