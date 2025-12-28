import type { Meta, StoryObj } from '@storybook/angular';
import { FmDividerComponent } from './divider.component';

const meta: Meta<FmDividerComponent> = {
  title: '基礎元件/分隔線',
  component: FmDividerComponent,
  args: {
    label: '其他登入方式',
    uppercase: true
  }
};

export default meta;

type Story = StoryObj<FmDividerComponent>;

export const 預設: Story = {};

export const 小寫: Story = {
  args: {
    uppercase: false
  }
};
