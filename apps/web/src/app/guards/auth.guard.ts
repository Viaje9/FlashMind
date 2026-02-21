import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, tap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { HomeEntryPreferenceService } from '../services/home-entry-preference.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.checkAuth().pipe(
    tap((isAuthenticated) => {
      if (!isAuthenticated) {
        router.navigate(['/login']);
      }
    }),
  );
};

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const homeEntryPreferenceService = inject(HomeEntryPreferenceService);

  return authService.checkAuth().pipe(
    map((isAuthenticated) => {
      if (isAuthenticated) {
        const preferredPath = homeEntryPreferenceService.getTodayPreferredPath() ?? '/home';
        router.navigate([preferredPath]);
        return false;
      }
      return true;
    }),
  );
};
