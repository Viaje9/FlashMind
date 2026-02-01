import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  FmButtonComponent,
  FmPageHeaderComponent,
  FmProfileCardComponent,
  FmSectionHeadingComponent,
  FmSettingRowComponent
} from '../../../../../../packages/ui/src/index';
import { AuthService } from '../../services/auth.service';
import { VERSION } from '../../../version';

@Component({
  selector: 'app-settings-page',
  imports: [
    FmPageHeaderComponent,
    FmButtonComponent,
    FmProfileCardComponent,
    FmSectionHeadingComponent,
    FmSettingRowComponent,
    RouterLink,
    ReactiveFormsModule
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsComponent {
  private authService = inject(AuthService);

  readonly version = VERSION;

  readonly user = this.authService.user;
  readonly loading = this.authService.loading;

  readonly dailyReminderControl = new FormControl(true);
  readonly spacedRepetitionControl = new FormControl(true);
  readonly smartShuffleControl = new FormControl(false);
  readonly userName = computed(() => {
    const email = this.user()?.email;
    return email ? email.split('@')[0] : '使用者';
  });

  readonly userEmail = computed(() => this.user()?.email || '');

  logout() {
    this.authService.logout().subscribe();
  }
}
