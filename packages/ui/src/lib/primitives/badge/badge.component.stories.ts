import type { Meta, StoryObj } from '@storybook/angular';
import { FmBadgeComponent } from './badge.component';

const meta: Meta<FmBadgeComponent> = {
  title: '基礎元件/徽章',
  component: FmBadgeComponent,
  args: {
    tone: 'info'
  },
  argTypes: {
    tone: {
      control: 'select',
      options: ['info', 'warning', 'success', 'neutral']
    }
  },
  render: (args) => ({
    props: args,
    template: '<fm-badge [tone]="tone">20 新卡片</fm-badge>'
  })
};

export default meta;

type Story = StoryObj<FmBadgeComponent>;

export const 資訊: Story = {
  args: {
    tone: 'info'
  }
};

export const 警告: Story = {
  args: {
    tone: 'warning'
  }
};

export const 成功: Story = {
  args: {
    tone: 'success'
  }
};

export const 中性: Story = {
  args: {
    tone: 'neutral'
  }
};
