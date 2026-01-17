import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'fm-social-login-row',
  templateUrl: './social-login-row.component.html',
  styleUrl: './social-login-row.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmSocialLoginRowComponent {
  readonly testId = input<string>();
  readonly googleClick = output<void>();

  onGoogleClick() {
    this.googleClick.emit();
  }
}
