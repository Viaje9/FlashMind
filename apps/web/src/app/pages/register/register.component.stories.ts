import type { Meta, StoryObj } from '@storybook/angular';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  FmAlertComponent,
  FmAuthHeaderComponent,
  FmAuthPageLayoutComponent,
  FmButtonComponent,
  FmDividerComponent,
  FmLabeledInputComponent,
  FmSocialLoginRowComponent
} from '@flashmind/ui';

/**
 * 註冊表單展示 - 組合多個 UI 元件展示完整的註冊介面
 */
const meta: Meta = {
  title: '頁面/認證/註冊表單',
  render: (args) => ({
    props: {
      ...args,
      emailControl: new FormControl(''),
      passwordControl: new FormControl(''),
      confirmPasswordControl: new FormControl(''),
      loading: false,
      errorMessage: args['errorMessage'] || null
    },
    moduleMetadata: {
      imports: [
        ReactiveFormsModule,
        FmAlertComponent,
        FmAuthHeaderComponent,
        FmAuthPageLayoutComponent,
        FmButtonComponent,
        FmDividerComponent,
        FmLabeledInputComponent,
        FmSocialLoginRowComponent
      ]
    },
    template: `
      <div class="h-[750px] bg-background-dark">
        <fm-auth-page-layout>
          <ng-container main>
            <fm-auth-header title="註冊帳號">
              <a href="#" class="text-primary hover:text-primary/80 transition-colors">登入現有帳號</a>
            </fm-auth-header>

            @if (errorMessage) {
              <fm-alert [message]="errorMessage" type="error" testId="register-error" />
            }

            <form class="w-full max-w-sm space-y-4">
              <fm-labeled-input
                [formControl]="emailControl"
                label="Email"
                icon="mail"
                placeholder="請輸入 Email"
                type="email"
                ariaLabel="Email"
                testId="register-email"
              />

              <fm-labeled-input
                [formControl]="passwordControl"
                label="密碼"
                icon="lock"
                placeholder="請輸入密碼（至少 8 字元）"
                type="password"
                ariaLabel="密碼"
                testId="register-password"
              />

              <fm-labeled-input
                [formControl]="confirmPasswordControl"
                label="確認密碼"
                icon="lock"
                placeholder="請再次輸入密碼"
                type="password"
                ariaLabel="確認密碼"
                testId="register-confirm-password"
              />

              <div class="pt-2">
                <fm-button type="submit" [fullWidth]="true" [disabled]="loading" testId="register-submit">
                  @if (loading) {
                    註冊中...
                  } @else {
                    註冊
                  }
                </fm-button>
              </div>
            </form>
          </ng-container>

          <ng-container footer>
            <fm-divider label="或使用其他方式註冊" [uppercase]="false" />
            <fm-social-login-row />
          </ng-container>
        </fm-auth-page-layout>
      </div>
    `
  })
};

export default meta;

type Story = StoryObj;

export const 預設: Story = {};

export const 顯示錯誤: Story = {
  args: {
    errorMessage: '此 Email 已被註冊，請使用其他 Email 或登入現有帳號'
  }
};

export const 載入中: Story = {
  render: (args) => ({
    props: {
      ...args,
      emailControl: new FormControl('newuser@example.com'),
      passwordControl: new FormControl('securePassword123'),
      confirmPasswordControl: new FormControl('securePassword123'),
      loading: true,
      errorMessage: null
    },
    moduleMetadata: {
      imports: [
        ReactiveFormsModule,
        FmAlertComponent,
        FmAuthHeaderComponent,
        FmAuthPageLayoutComponent,
        FmButtonComponent,
        FmDividerComponent,
        FmLabeledInputComponent,
        FmSocialLoginRowComponent
      ]
    },
    template: `
      <div class="h-[750px] bg-background-dark">
        <fm-auth-page-layout>
          <ng-container main>
            <fm-auth-header title="註冊帳號">
              <a href="#" class="text-primary hover:text-primary/80 transition-colors">登入現有帳號</a>
            </fm-auth-header>

            <form class="w-full max-w-sm space-y-4">
              <fm-labeled-input
                [formControl]="emailControl"
                label="Email"
                icon="mail"
                placeholder="請輸入 Email"
                type="email"
                ariaLabel="Email"
              />

              <fm-labeled-input
                [formControl]="passwordControl"
                label="密碼"
                icon="lock"
                placeholder="請輸入密碼（至少 8 字元）"
                type="password"
                ariaLabel="密碼"
              />

              <fm-labeled-input
                [formControl]="confirmPasswordControl"
                label="確認密碼"
                icon="lock"
                placeholder="請再次輸入密碼"
                type="password"
                ariaLabel="確認密碼"
              />

              <div class="pt-2">
                <fm-button type="submit" [fullWidth]="true" [disabled]="loading">
                  註冊中...
                </fm-button>
              </div>
            </form>
          </ng-container>

          <ng-container footer>
            <fm-divider label="或使用其他方式註冊" [uppercase]="false" />
            <fm-social-login-row />
          </ng-container>
        </fm-auth-page-layout>
      </div>
    `
  })
};
