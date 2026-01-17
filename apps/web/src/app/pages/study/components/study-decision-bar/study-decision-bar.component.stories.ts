import type { Meta, StoryObj } from '@storybook/angular';
import { FmStudyDecisionBarComponent } from './study-decision-bar.component';

const meta: Meta<FmStudyDecisionBarComponent> = {
  title: '組合元件/學習決策列',
  component: FmStudyDecisionBarComponent,
  args: {
    layout: 'stacked',
    unknownLabel: '不知道',
    knownLabel: '知道',
    disabled: false
  },
  argTypes: {
    layout: {
      control: 'select',
      options: ['stacked', 'inline']
    }
  },
  render: (args) => ({
    props: args,
    template:
      '<div class="bg-background-light dark:bg-background-dark p-4 max-w-md">'
      + '<fm-study-decision-bar [layout]="layout" [unknownLabel]="unknownLabel" [knownLabel]="knownLabel" [disabled]="disabled"></fm-study-decision-bar>'
      + '</div>'
  })
};

export default meta;

type Story = StoryObj<FmStudyDecisionBarComponent>;

export const 堆疊: Story = {};

export const 橫向: Story = {
  args: {
    layout: 'inline'
  }
};

export const 停用: Story = {
  args: {
    disabled: true
  }
};
