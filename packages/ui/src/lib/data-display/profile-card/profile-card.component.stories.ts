import type { Meta, StoryObj } from '@storybook/angular';
import { FmProfileCardComponent } from './profile-card.component';

const meta: Meta<FmProfileCardComponent> = {
  title: '分子元件/個人資料卡',
  component: FmProfileCardComponent,
  args: {
    name: '王小明',
    email: 'xiaoming@example.com',
    actionLabel: '管理帳戶'
  },
  render: (args) => ({
    props: args,
    template:
      '<div class="bg-background-light dark:bg-background-dark p-4">'
      + '<fm-profile-card [name]="name" [email]="email" [actionLabel]="actionLabel"></fm-profile-card>'
      + '</div>'
  })
};

export default meta;

type Story = StoryObj<FmProfileCardComponent>;

export const 預設: Story = {};

export const 無操作按鈕: Story = {
  args: {
    actionLabel: ''
  }
};
