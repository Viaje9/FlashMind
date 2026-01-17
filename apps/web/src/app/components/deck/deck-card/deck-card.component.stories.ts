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
    showAction: true
  },
  render: (args) => ({
    props: args,
    template:
      '<div class="bg-background-light dark:bg-background-dark p-4 max-w-md">'
      + '<fm-deck-card [title]="title" [newCount]="newCount" [reviewCount]="reviewCount" [progress]="progress" [completed]="completed" [showAction]="showAction"></fm-deck-card>'
      + '</div>'
  })
};

export default meta;

type Story = StoryObj<FmDeckCardComponent>;

export const 預設: Story = {};

export const 已完成: Story = {
  args: {
    title: '數學公式',
    newCount: 0,
    reviewCount: 0,
    progress: 100,
    completed: true,
    showAction: false
  }
};

export const 自訂標籤: Story = {
  args: {
    title: '歷史年代',
    tags: [
      { id: 'custom-1', text: '30 新卡片', tone: 'info' },
      { id: 'custom-2', text: '0 待複習', tone: 'neutral' }
    ]
  }
};
