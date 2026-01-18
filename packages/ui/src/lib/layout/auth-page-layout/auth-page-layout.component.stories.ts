import type { Meta, StoryObj } from '@storybook/angular';
import { FmAuthPageLayoutComponent } from './auth-page-layout.component';
import { FmAuthHeaderComponent } from '../auth-header/auth-header.component';
import { FmButtonComponent } from '../../primitives/button/button.component';
import { FmDividerComponent } from '../../primitives/divider/divider.component';
import { FmSocialLoginRowComponent } from '../../forms/social-login-row/social-login-row.component';

const meta: Meta<FmAuthPageLayoutComponent> = {
  title: '佈局/認證頁面佈局',
  component: FmAuthPageLayoutComponent,
  args: {
    mainAlign: 'center'
  },
  render: (args) => ({
    props: args,
    moduleMetadata: {
      imports: [
        FmAuthHeaderComponent,
        FmButtonComponent,
        FmDividerComponent,
        FmSocialLoginRowComponent
      ]
    },
    template: `
      <div class="h-[600px] bg-background-dark">
        <fm-auth-page-layout [mainAlign]="mainAlign">
          <ng-container main>
            <fm-auth-header title="登入帳號">
              <a href="#" class="text-primary hover:text-primary/80 transition-colors">註冊新帳號</a>
            </fm-auth-header>
            <div class="w-full max-w-sm space-y-4">
              <div class="space-y-2">
                <label class="text-sm text-slate-300">Email</label>
                <input type="email" placeholder="請輸入 Email" class="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white" />
              </div>
              <div class="space-y-2">
                <label class="text-sm text-slate-300">密碼</label>
                <input type="password" placeholder="請輸入密碼" class="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white" />
              </div>
              <fm-button [fullWidth]="true">登入</fm-button>
            </div>
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

type Story = StoryObj<FmAuthPageLayoutComponent>;

export const 置中對齊: Story = {};

export const 頂部對齊: Story = {
  args: {
    mainAlign: 'start'
  }
};
