import type { Meta, StoryObj } from '@storybook/angular';
import { FmNumberInputRowComponent } from './number-input-row.component';

const meta: Meta<FmNumberInputRowComponent> = {
  title: '表單/數字設定列',
  component: FmNumberInputRowComponent,
  args: {
    label: '每日新卡數',
    title: '新學習',
    description: '建議初學者設定 20 張',
    icon: 'library_add',
    iconClass: 'bg-blue-500/10 text-blue-500',
    value: 20,
    unit: '張',
    min: 0,
    max: 200,
    step: 5,
    disabled: false
  },
  render: (args) => ({
    props: args,
    template:
      '<div class="bg-background-light dark:bg-background-dark p-4">'
      + '<fm-number-input-row [label]="label" [title]="title" [description]="description" [icon]="icon" [iconClass]="iconClass" [value]="value" [unit]="unit" [min]="min" [max]="max" [step]="step" [disabled]="disabled"></fm-number-input-row>'
      + '</div>'
  })
};

export default meta;

type Story = StoryObj<FmNumberInputRowComponent>;

export const 預設: Story = {};

export const 複習上限: Story = {
  args: {
    label: '每日複習數',
    title: '複習上限',
    description: '包含舊卡片複習',
    icon: 'history',
    iconClass: 'bg-amber-500/10 text-amber-500',
    value: 100,
    step: 10
  }
};

export const 停用: Story = {
  args: {
    disabled: true
  }
};
