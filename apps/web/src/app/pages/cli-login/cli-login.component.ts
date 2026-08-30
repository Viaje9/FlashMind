import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CliLoginPanelComponent } from '../../components/auth/cli-login/cli-login.component';

@Component({
  selector: 'app-cli-login',
  imports: [CliLoginPanelComponent],
  template: '<app-cli-login-panel />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CliLoginComponent {}
