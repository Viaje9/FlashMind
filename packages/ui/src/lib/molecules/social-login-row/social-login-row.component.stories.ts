import type { Meta, StoryObj } from '@storybook/angular';
import { FmSocialLoginRowComponent } from './social-login-row.component';

const meta: Meta<FmSocialLoginRowComponent> = {
  title: '分子元件/社群登入列',
  component: FmSocialLoginRowComponent,
  render: () => ({
    template:
      '<div class="bg-background-light dark:bg-background-dark p-6">'
      + '<fm-social-login-row></fm-social-login-row>'
      + '</div>'
  })
};

export default meta;

type Story = StoryObj<FmSocialLoginRowComponent>;

export const 預設: Story = {};
