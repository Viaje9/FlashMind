import type { Meta, StoryObj } from '@storybook/angular';
import { FmDeckStatsCardComponent } from './deck-stats-card.component';

const meta: Meta<FmDeckStatsCardComponent> = {
  title: '組合元件/牌組統計卡',
  component: FmDeckStatsCardComponent,
  args: {
    newCount: 12,
    reviewCount: 30,
    createdAtLabel: '2023/10/24',
    lastReviewLabel: '昨天',
    actionLabel: '開始學習'
  },
  render: (args) => ({
    props: args,
    template:
      '<div class="bg-background-light dark:bg-background-dark p-4 max-w-md">'
      + '<fm-deck-stats-card [newCount]="newCount" [reviewCount]="reviewCount" [createdAtLabel]="createdAtLabel" [lastReviewLabel]="lastReviewLabel" [actionLabel]="actionLabel"></fm-deck-stats-card>'
      + '</div>'
  })
};

export default meta;

type Story = StoryObj<FmDeckStatsCardComponent>;

export const 預設: Story = {};

export const 單一資訊: Story = {
  args: {
    lastReviewLabel: '',
    createdAtLabel: '2023/10/01'
  }
};
