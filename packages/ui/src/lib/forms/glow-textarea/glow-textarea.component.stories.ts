import type { Meta, StoryObj } from '@storybook/angular';
import { FmGlowTextareaComponent } from './glow-textarea.component';

const meta: Meta<FmGlowTextareaComponent> = {
  title: '表單/發光文字輸入',
  component: FmGlowTextareaComponent,
  args: {
    value: 'Hello',
    placeholder: '輸入單字、片語或問題...',
    minHeightClass: 'min-h-[140px]',
    maxLength: 200,
    showCount: true,
    disabled: false
  },
  render: (args) => ({
    props: args,
    template:
      '<div class="bg-background-light dark:bg-background-dark p-4">'
      + '<fm-glow-textarea [value]="value" [placeholder]="placeholder" [minHeightClass]="minHeightClass" [maxLength]="maxLength" [showCount]="showCount" [disabled]="disabled"></fm-glow-textarea>'
      + '</div>'
  })
};

export default meta;

type Story = StoryObj<FmGlowTextareaComponent>;

export const 預設: Story = {};

export const 無計數: Story = {
  args: {
    showCount: false
  }
};

export const 停用: Story = {
  args: {
    disabled: true
  }
};
