import type { Meta, StoryObj } from '@storybook/angular';
import { FmLabeledInputComponent } from './labeled-input.component';

const meta: Meta<FmLabeledInputComponent> = {
  title: '表單/標籤輸入框',
  component: FmLabeledInputComponent,
  args: {
    label: '牌組名稱',
    placeholder: '例如：日文 N5 單字',
    value: '',
    icon: 'style',
    type: 'text',
    disabled: false
  },
  render: (args) => ({
    props: args,
    template:
      '<div class="bg-background-light dark:bg-background-dark p-4">'
      + '<fm-labeled-input [label]="label" [placeholder]="placeholder" [value]="value" [icon]="icon" [type]="type" [disabled]="disabled"></fm-labeled-input>'
      + '</div>'
  })
};

export default meta;

type Story = StoryObj<FmLabeledInputComponent>;

export const 空白: Story = {};

export const 有內容: Story = {
  args: {
    value: '托福核心單字'
  }
};

export const 停用: Story = {
  args: {
    disabled: true
  }
};
