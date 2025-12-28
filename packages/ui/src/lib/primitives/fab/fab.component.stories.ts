import type { Meta, StoryObj } from '@storybook/angular';
import { FmFabComponent } from './fab.component';

const meta: Meta<FmFabComponent> = {
  title: '基礎元件/浮動按鈕',
  component: FmFabComponent,
  args: {
    size: 'lg',
    disabled: false,
    ariaLabel: '新增'
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['md', 'lg']
    }
  },
  render: (args) => ({
    props: args,
    template:
      '<fm-fab [size]="size" [disabled]="disabled" [ariaLabel]="ariaLabel">'
      + '<span class="material-symbols-outlined text-[28px]">add</span>'
      + '</fm-fab>'
  })
};

export default meta;

type Story = StoryObj<FmFabComponent>;

export const 預設: Story = {};

export const 中尺寸: Story = {
  args: {
    size: 'md'
  }
};

export const 停用: Story = {
  args: {
    disabled: true
  }
};
