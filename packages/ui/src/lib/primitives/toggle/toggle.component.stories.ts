import type { Meta, StoryObj } from '@storybook/angular';
import { FmToggleComponent } from './toggle.component';

const meta: Meta<FmToggleComponent> = {
  title: '基礎元件/切換開關',
  component: FmToggleComponent,
  args: {
    checked: true,
    disabled: false,
    ariaLabel: '啟用設定'
  }
};

export default meta;

type Story = StoryObj<FmToggleComponent>;

export const 開啟: Story = {
  args: {
    checked: true
  }
};

export const 關閉: Story = {
  args: {
    checked: false
  }
};

export const 停用: Story = {
  args: {
    disabled: true
  }
};
