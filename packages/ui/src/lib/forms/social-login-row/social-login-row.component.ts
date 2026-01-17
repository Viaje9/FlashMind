import { ChangeDetectionStrategy, Component, output } from '@angular/core';

@Component({
  selector: 'fm-social-login-row',
  templateUrl: './social-login-row.component.html',
  styleUrl: './social-login-row.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FmSocialLoginRowComponent {
  readonly appleClick = output<void>();
  readonly googleClick = output<void>();
  readonly facebookClick = output<void>();

  onAppleClick() {
    this.appleClick.emit();
  }

  onGoogleClick() {
    this.googleClick.emit();
  }

  onFacebookClick() {
    this.facebookClick.emit();
  }
}
