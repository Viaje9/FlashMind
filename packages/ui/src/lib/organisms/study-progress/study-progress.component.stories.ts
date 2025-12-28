import type { Meta, StoryObj } from '@storybook/angular';
import { FmStudyProgressComponent } from './study-progress.component';

const meta: Meta<FmStudyProgressComponent> = {
  title: '組合元件/學習進度',
  component: FmStudyProgressComponent,
  args: {
    label: '進度',
    current: 12,
    total: 50,
    value: null,
    tone: 'primary'
  },
  argTypes: {
    tone: {
      control: 'select',
      options: ['primary', 'success', 'danger']
    }
  },
  render: (args) => ({
    props: args,
    template:
      '<div class="bg-background-light dark:bg-background-dark p-4 max-w-md">'
      + '<fm-study-progress [label]="label" [current]="current" [total]="total" [value]="value" [tone]="tone"></fm-study-progress>'
      + '</div>'
  })
};

export default meta;

type Story = StoryObj<FmStudyProgressComponent>;

export const 預設: Story = {};

export const 直接指定: Story = {
  args: {
    value: 80,
    current: 40,
    total: 50
  }
};
