import { ChangeDetectionStrategy, Component, output } from '@angular/core';

@Component({
  selector: 'fm-social-login-row',
  templateUrl: './social-login-row.component.html',
  styleUrl: './social-login-row.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmSocialLoginRowComponent {
  readonly googleClick = output<void>();

  onGoogleClick() {
    this.googleClick.emit();
  }
}
