import type { Meta, StoryObj } from '@storybook/angular';
import { FmAuthHeaderComponent } from './auth-header.component';

const meta: Meta<FmAuthHeaderComponent> = {
  title: '佈局/認證標題',
  component: FmAuthHeaderComponent,
  args: {
    title: '登入帳號',
    prefix: '或'
  },
  render: (args) => ({
    props: args,
    template:
      '<div class="bg-background-light dark:bg-background-dark p-6">' +
      '<fm-auth-header [title]="title" [prefix]="prefix">' +
      '<a href="#" class="text-primary hover:text-primary/80 transition-colors">註冊新帳號</a>' +
      '</fm-auth-header>' +
      '</div>'
  })
};

export default meta;

type Story = StoryObj<FmAuthHeaderComponent>;

export const 登入: Story = {};

export const 註冊: Story = {
  args: {
    title: '註冊帳號'
  },
  render: (args) => ({
    props: args,
    template:
      '<div class="bg-background-light dark:bg-background-dark p-6">' +
      '<fm-auth-header [title]="title" [prefix]="prefix">' +
      '<a href="#" class="text-primary hover:text-primary/80 transition-colors">登入現有帳號</a>' +
      '</fm-auth-header>' +
      '</div>'
  })
};

export const 自訂前綴: Story = {
  args: {
    title: '歡迎回來',
    prefix: '還沒有帳號？'
  },
  render: (args) => ({
    props: args,
    template:
      '<div class="bg-background-light dark:bg-background-dark p-6">' +
      '<fm-auth-header [title]="title" [prefix]="prefix">' +
      '<a href="#" class="text-primary hover:text-primary/80 transition-colors">立即註冊</a>' +
      '</fm-auth-header>' +
      '</div>'
  })
};
