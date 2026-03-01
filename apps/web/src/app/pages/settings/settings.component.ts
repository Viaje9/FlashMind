import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
  readonly refreshing = signal(false);

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

  async refreshApp(): Promise<void> {
    if (this.refreshing()) {
      return;
    }

    this.refreshing.set(true);
    try {
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
      }

      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
    } catch (error) {
      console.warn('手動更新時清除快取失敗，改為直接重整', error);
    } finally {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('appVersion', this.version.version);
      nextUrl.searchParams.set('ts', Date.now().toString());
      window.location.replace(nextUrl.toString());
    }
  }

  logout() {
    this.authService.logout().subscribe();
  }
}
