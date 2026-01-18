import type { Meta, StoryObj } from '@storybook/angular';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  FmAlertComponent,
  FmAuthHeaderComponent,
  FmAuthPageLayoutComponent,
  FmButtonComponent,
  FmDividerComponent,
  FmLabeledInputComponent,
  FmSocialLoginRowComponent,
  FmToggleComponent
} from '@flashmind/ui';

/**
 * 登入表單展示 - 組合多個 UI 元件展示完整的登入介面
 */
const meta: Meta = {
  title: '頁面/認證/登入表單',
  render: (args) => ({
    props: {
      ...args,
      emailControl: new FormControl(''),
      passwordControl: new FormControl(''),
      rememberMeControl: new FormControl(false),
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
        FmSocialLoginRowComponent,
        FmToggleComponent
      ]
    },
    template: `
      <div class="h-[700px] bg-background-dark">
        <fm-auth-page-layout>
          <ng-container main>
            <fm-auth-header title="登入帳號">
              <a href="#" class="text-primary hover:text-primary/80 transition-colors">註冊新帳號</a>
            </fm-auth-header>

            @if (errorMessage) {
              <fm-alert [message]="errorMessage" type="error" testId="login-error" />
            }

            <form class="w-full max-w-sm space-y-4">
              <fm-labeled-input
                [formControl]="emailControl"
                label="Email"
                icon="mail"
                placeholder="請輸入 Email"
                type="email"
                ariaLabel="Email"
                testId="login-email"
              />

              <fm-labeled-input
                [formControl]="passwordControl"
                label="密碼"
                icon="lock"
                placeholder="請輸入密碼"
                type="password"
                ariaLabel="密碼"
                testId="login-password"
              />

              <div class="flex items-center gap-3 py-2">
                <fm-toggle [formControl]="rememberMeControl" ariaLabel="記住我" testId="login-remember-me" />
                <span class="text-sm text-slate-300">記住我</span>
              </div>

              <div class="pt-2">
                <fm-button type="submit" [fullWidth]="true" [disabled]="loading" testId="login-submit">
                  @if (loading) {
                    登入中...
                  } @else {
                    登入
                  }
                </fm-button>
              </div>
            </form>
          </ng-container>

          <ng-container footer>
            <fm-divider label="或使用其他方式登入" [uppercase]="false" />
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
    errorMessage: 'Email 或密碼錯誤，請重新輸入'
  }
};

export const 載入中: Story = {
  render: (args) => ({
    props: {
      ...args,
      emailControl: new FormControl('user@example.com'),
      passwordControl: new FormControl('password123'),
      rememberMeControl: new FormControl(true),
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
        FmSocialLoginRowComponent,
        FmToggleComponent
      ]
    },
    template: `
      <div class="h-[700px] bg-background-dark">
        <fm-auth-page-layout>
          <ng-container main>
            <fm-auth-header title="登入帳號">
              <a href="#" class="text-primary hover:text-primary/80 transition-colors">註冊新帳號</a>
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
                placeholder="請輸入密碼"
                type="password"
                ariaLabel="密碼"
              />

              <div class="flex items-center gap-3 py-2">
                <fm-toggle [formControl]="rememberMeControl" ariaLabel="記住我" />
                <span class="text-sm text-slate-300">記住我</span>
              </div>

              <div class="pt-2">
                <fm-button type="submit" [fullWidth]="true" [disabled]="loading">
                  登入中...
                </fm-button>
              </div>
            </form>
          </ng-container>

          <ng-container footer>
            <fm-divider label="或使用其他方式登入" [uppercase]="false" />
            <fm-social-login-row />
          </ng-container>
        </fm-auth-page-layout>
      </div>
    `
  })
};
