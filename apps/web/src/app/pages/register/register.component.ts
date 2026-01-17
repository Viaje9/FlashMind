import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { form, FormField, required, email, minLength, validate, submit } from '@angular/forms/signals';
import { AuthService } from '../../services/auth.service';
import {
  FmAlertComponent,
  FmAuthHeaderComponent,
  FmAuthPageLayoutComponent,
  FmButtonComponent,
  FmDividerComponent,
  FmLabeledInputComponent,
  FmSocialLoginRowComponent
} from '@flashmind/ui';

interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
}

@Component({
  selector: 'app-register',
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
    FmSocialLoginRowComponent
  ],
  templateUrl: './register.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly formModel = signal<RegisterFormData>({
    email: '',
    password: '',
    confirmPassword: ''
  });

  readonly registerForm = form(this.formModel, (f) => {
    required(f.email, { message: '請輸入 Email' });
    email(f.email, { message: '請輸入有效的 Email 格式' });
    required(f.password, { message: '請輸入密碼' });
    minLength(f.password, 8, { message: '密碼至少需要 8 個字元' });
    required(f.confirmPassword, { message: '請再次輸入密碼' });
    validate(f.confirmPassword, ({ value }) => {
      const password = this.formModel().password;
      if (value() && password && value() !== password) {
        return { kind: 'passwordMismatch', message: '密碼與確認密碼不一致' };
      }
      return undefined;
    });
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

    await submit(this.registerForm, async () => {
      const { email, password } = this.formModel();

      return new Promise<void>((resolve, reject) => {
        this.authService.register(email, password).subscribe({
          next: () => {
            this.router.navigate(['/decks']);
            resolve();
          },
          error: (err) => {
            this.apiError.set(err.message);
            reject(err);
          }
        });
      });
    });
  }

  loginWithGoogle(): void {
    this.authService.loginWithGoogle();
  }
}
