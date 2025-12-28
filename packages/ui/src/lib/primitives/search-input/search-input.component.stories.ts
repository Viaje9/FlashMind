import type { Meta, StoryObj } from '@storybook/angular';
import { FmSearchInputComponent } from './search-input.component';

const meta: Meta<FmSearchInputComponent> = {
  title: '基礎元件/搜尋輸入',
  component: FmSearchInputComponent,
  args: {
    value: '',
    placeholder: '搜尋牌組...',
    disabled: false,
    ariaLabel: '搜尋'
  }
};

export default meta;

type Story = StoryObj<FmSearchInputComponent>;

export const 空白: Story = {};

export const 有內容: Story = {
  args: {
    value: '英文'
  }
};

export const 停用: Story = {
  args: {
    disabled: true
  }
};
