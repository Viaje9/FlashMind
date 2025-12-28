import type { Meta, StoryObj } from '@storybook/angular';
import { FmIconButtonComponent } from './icon-button.component';

const meta: Meta<FmIconButtonComponent> = {
  title: '基礎元件/圖示按鈕',
  component: FmIconButtonComponent,
  args: {
    variant: 'neutral',
    size: 'md',
    disabled: false,
    ariaLabel: '設定'
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['neutral', 'primary', 'ghost', 'danger']
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg']
    }
  },
  render: (args) => ({
    props: args,
    template:
      '<fm-icon-button [variant]="variant" [size]="size" [disabled]="disabled" [ariaLabel]="ariaLabel">'
      + '<span class="material-symbols-outlined">settings</span>'
      + '</fm-icon-button>'
  })
};

export default meta;

type Story = StoryObj<FmIconButtonComponent>;

export const 預設: Story = {};

export const 主要: Story = {
  args: {
    variant: 'primary'
  }
};

export const 危險: Story = {
  args: {
    variant: 'danger'
  }
};

export const 小尺寸: Story = {
  args: {
    size: 'sm'
  }
};

export const 大尺寸: Story = {
  args: {
    size: 'lg'
  }
};
