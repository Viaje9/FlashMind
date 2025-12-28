import type { Meta, StoryObj } from '@storybook/angular';
import { FmProgressBarComponent } from './progress-bar.component';

const meta: Meta<FmProgressBarComponent> = {
  title: '基礎元件/進度條',
  component: FmProgressBarComponent,
  args: {
    value: 45,
    showLabel: true,
    tone: 'primary'
  },
  argTypes: {
    tone: {
      control: 'select',
      options: ['primary', 'success', 'danger']
    }
  }
};

export default meta;

type Story = StoryObj<FmProgressBarComponent>;

export const 預設: Story = {};

export const 完成: Story = {
  args: {
    value: 100,
    tone: 'success'
  }
};

export const 警示: Story = {
  args: {
    value: 25,
    tone: 'danger'
  }
};

export const 無標籤: Story = {
  args: {
    showLabel: false
  }
};
