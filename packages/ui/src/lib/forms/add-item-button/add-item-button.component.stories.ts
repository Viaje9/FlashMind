import type { Meta, StoryObj } from '@storybook/angular';
import { FmAddItemButtonComponent } from './add-item-button.component';

const meta: Meta<FmAddItemButtonComponent> = {
  title: '表單/新增按鈕',
  component: FmAddItemButtonComponent,
  args: {
    label: '新增詞義',
    icon: 'add_circle',
    disabled: false
  }
};

export default meta;

type Story = StoryObj<FmAddItemButtonComponent>;

export const 預設: Story = {};

export const 停用: Story = {
  args: {
    disabled: true
  }
};
