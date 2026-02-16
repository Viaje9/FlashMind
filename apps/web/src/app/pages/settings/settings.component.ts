import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  FmButtonComponent,
  FmPageHeaderComponent,
  FmProfileCardComponent,
  FmSectionHeadingComponent,
  FmSettingRowComponent,
} from '@flashmind/ui';
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
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly version = VERSION;

  readonly user = this.authService.user;
  readonly loading = this.authService.loading;

  readonly userName = computed(() => {
    const email = this.user()?.email;
    return email ? email.split('@')[0] : '使用者';
  });

  readonly userEmail = computed(() => this.user()?.email || '');

  goToVocabSettings() {
    void this.router.navigate(['/settings/vocab']);
  }

  goToSpeakingSettings() {
    void this.router.navigate(['/settings/speaking']);
  }

  logout() {
    this.authService.logout().subscribe();
  }
}
