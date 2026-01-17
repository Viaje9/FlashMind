import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService as ApiAuthService, User, UserResponse, Configuration } from '@flashmind/api-client';
import { catchError, tap, Observable, of, map } from 'rxjs';
import { LoadingService } from './loading.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiAuth = inject(ApiAuthService);
  private readonly router = inject(Router);
  private readonly loadingService = inject(LoadingService);
  private readonly config = inject(Configuration);

  private _user = signal<User | null>(null);
  private _initialized = signal(false);

  readonly user = this._user.asReadonly();
  readonly loading = this.loadingService.loading;
  readonly initialized = this._initialized.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  checkAuth(): Observable<boolean> {
    if (this._initialized()) {
      return of(this.isAuthenticated());
    }

    return this.apiAuth.getCurrentUser().pipe(
      tap((response: UserResponse) => {
        this._user.set(response.data);
        this._initialized.set(true);
      }),
      map(() => true),
      catchError(() => {
        this._user.set(null);
        this._initialized.set(true);
        return of(false);
      }),
    );
  }

  login(email: string, password: string, rememberMe = false): Observable<UserResponse> {
    return this.apiAuth.login({ email, password, rememberMe }).pipe(
      tap((response: UserResponse) => {
        this._user.set(response.data);
      }),
    );
  }

  register(email: string, password: string): Observable<UserResponse> {
    return this.apiAuth.register({ email, password }).pipe(
      tap((response: UserResponse) => {
        this._user.set(response.data);
      }),
    );
  }

  logout(): Observable<void> {
    return this.apiAuth.logout().pipe(
      tap(() => {
        this._user.set(null);
        this.router.navigate(['/welcome']);
      }),
    );
  }

  loginWithGoogle(rememberMe = false): void {
    const basePath = this.config.basePath || '';
    window.location.href = `${basePath}/auth/google?rememberMe=${rememberMe}`;
  }
}
