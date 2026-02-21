import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { form, FormField, required, email, submit } from '@angular/forms/signals';
import { AuthService } from '../../services/auth.service';
import { HomeEntryPreferenceService } from '../../services/home-entry-preference.service';
import {
  FmAlertComponent,
  FmAuthHeaderComponent,
  FmAuthPageLayoutComponent,
  FmButtonComponent,
  FmDividerComponent,
  FmLabeledInputComponent,
  FmSocialLoginRowComponent,
  FmToggleComponent,
} from '@flashmind/ui';

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    RouterLink,
    FormField,
    FmAlertComponent,
    FmAuthHeaderComponent,
    FmAuthPageLayoutComponent,
    FmButtonComponent,
    FmDividerComponent,
    FmLabeledInputComponent,
    FmSocialLoginRowComponent,
    FmToggleComponent,
  ],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly homeEntryPreferenceService = inject(HomeEntryPreferenceService);

  readonly formModel = signal<LoginFormData>({
    email: '',
    password: '',
    rememberMe: false,
  });

  readonly loginForm = form(this.formModel, (f) => {
    required(f.email, { message: '請輸入 Email' });
    email(f.email, { message: '請輸入有效的 Email 格式' });
    required(f.password, { message: '請輸入密碼' });
  });

  readonly loading = this.authService.loading;
  readonly apiError = signal<string | null>(null);

  get errorMessage(): string | null {
    if (this.apiError()) {
      return this.apiError();
    }
    return null;
  }

  async onSubmit(): Promise<void> {
    this.apiError.set(null);

    await submit(this.loginForm, async () => {
      const { email, password, rememberMe } = this.formModel();
      return new Promise<void>((resolve, reject) => {
        this.authService.login(email, password, rememberMe).subscribe({
          next: () => {
            const preferredPath =
              this.homeEntryPreferenceService.getTodayPreferredPath() ?? '/home';
            this.router.navigate([preferredPath]);
            resolve();
          },
          error: (err) => {
            this.apiError.set(err.message);
            reject(err);
          },
        });
      });
    }).catch(() => {
      // 驗證失敗或 API 錯誤已處理
    });
  }

  loginWithGoogle(): void {
    this.authService.loginWithGoogle(this.formModel().rememberMe);
  }
}
