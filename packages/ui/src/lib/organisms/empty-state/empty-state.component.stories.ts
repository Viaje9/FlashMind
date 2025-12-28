import type { Meta, StoryObj } from '@storybook/angular';
import { FmEmptyStateComponent } from './empty-state.component';

const meta: Meta<FmEmptyStateComponent> = {
  title: '組合元件/空狀態',
  component: FmEmptyStateComponent,
  args: {
    icon: 'library_add',
    title: '尚無牌組',
    description: '點擊 + 按鈕建立新牌組。'
  },
  render: (args) => ({
    props: args,
    template:
      '<div class="bg-background-light dark:bg-background-dark p-6 max-w-md">'
      + '<fm-empty-state [icon]="icon" [title]="title" [description]="description"></fm-empty-state>'
      + '</div>'
  })
};

export default meta;

type Story = StoryObj<FmEmptyStateComponent>;

export const 預設: Story = {};
