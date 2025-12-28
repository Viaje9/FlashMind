import type { Meta, StoryObj } from '@storybook/angular';
import { FmButtonComponent } from './button.component';

const meta: Meta<FmButtonComponent> = {
  title: '基礎元件/按鈕',
  component: FmButtonComponent,
  args: {
    variant: 'primary',
    size: 'md',
    fullWidth: false,
    disabled: false,
    type: 'button'
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger']
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg']
    },
    type: {
      control: 'select',
      options: ['button', 'submit', 'reset']
    }
  },
  render: (args) => ({
    props: args,
    template:
      '<fm-button [variant]="variant" [size]="size" [fullWidth]="fullWidth" [disabled]="disabled" [type]="type">主要動作</fm-button>'
  })
};

export default meta;

type Story = StoryObj<FmButtonComponent>;

export const 主要: Story = {};

export const 次要: Story = {
  args: {
    variant: 'secondary'
  }
};

export const 幽靈: Story = {
  args: {
    variant: 'ghost'
  }
};

export const 危險: Story = {
  args: {
    variant: 'danger'
  }
};

export const 滿寬: Story = {
  args: {
    fullWidth: true
  }
};
