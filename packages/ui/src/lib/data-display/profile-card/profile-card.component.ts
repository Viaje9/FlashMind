import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'fm-profile-card',
  templateUrl: './profile-card.component.html',
  styleUrl: './profile-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmProfileCardComponent {
  readonly name = input('使用者');
  readonly email = input('');
  readonly actionLabel = input('');
  readonly testId = input<string>();

  readonly actionClick = output<void>();
}
