import type { Meta, StoryObj } from '@storybook/angular';
import { FmDeckCardComponent } from './deck-card.component';

const meta: Meta<FmDeckCardComponent> = {
  title: '組合元件/牌組卡片',
  component: FmDeckCardComponent,
  args: {
    title: '英文詞彙',
    newCount: 20,
    reviewCount: 15,
    progress: 45,
    completed: false,
    showAction: true,
    actionLabel: '開始學習',
    actionDisabled: false,
    dailyNewCards: 20,
    dailyReviewCards: 100,
    todayNewStudied: 5,
    todayReviewStudied: 12
  },
  render: (args) => ({
    props: args,
    template:
      '<div class="bg-background-light dark:bg-background-dark p-4 max-w-md">'
      + '<fm-deck-card [title]="title" [newCount]="newCount" [reviewCount]="reviewCount" [progress]="progress" [completed]="completed" [showAction]="showAction" [actionLabel]="actionLabel" [actionDisabled]="actionDisabled" [enableReverse]="enableReverse" [dailyNewCards]="dailyNewCards" [dailyReviewCards]="dailyReviewCards" [todayNewStudied]="todayNewStudied" [todayReviewStudied]="todayReviewStudied"></fm-deck-card>'
      + '</div>'
  })
};

export default meta;

type Story = StoryObj<FmDeckCardComponent>;

export const 預設: Story = {};

export const 有進度: Story = {
  args: {
    title: '日文五十音',
    newCount: 12,
    reviewCount: 30,
    progress: 60,
    dailyNewCards: 20,
    dailyReviewCards: 100,
    todayNewStudied: 8,
    todayReviewStudied: 45
  }
};

export const 已達上限: Story = {
  args: {
    title: '數學公式',
    newCount: 0,
    reviewCount: 0,
    progress: 75,
    dailyNewCards: 20,
    dailyReviewCards: 100,
    todayNewStudied: 20,
    todayReviewStudied: 100,
    actionLabel: '已完成',
    actionDisabled: true
  }
};

export const 無待學習: Story = {
  args: {
    title: '歷史年代',
    newCount: 0,
    reviewCount: 0,
    progress: 30,
    dailyNewCards: 20,
    dailyReviewCards: 100,
    todayNewStudied: 3,
    todayReviewStudied: 10,
    actionLabel: '無待學習',
    actionDisabled: true
  }
};

export const 已完成全部: Story = {
  args: {
    title: '基礎英文',
    newCount: 0,
    reviewCount: 0,
    progress: 100,
    completed: true,
    dailyNewCards: 20,
    dailyReviewCards: 100,
    todayNewStudied: 20,
    todayReviewStudied: 50,
    actionLabel: '已完成',
    actionDisabled: true
  }
};

export const 含反向學習: Story = {
  args: {
    title: '英日對照',
    newCount: 25,
    reviewCount: 18,
    progress: 40,
    enableReverse: true,
    dailyNewCards: 30,
    dailyReviewCards: 150,
    todayNewStudied: 10,
    todayReviewStudied: 32
  }
};
