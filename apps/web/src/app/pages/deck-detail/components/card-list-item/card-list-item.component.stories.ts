import type { Meta, StoryObj } from '@storybook/angular';
import { FmCardListItemComponent } from './card-list-item.component';

const meta: Meta<FmCardListItemComponent> = {
  title: '組合元件/卡片列表項目',
  component: FmCardListItemComponent,
  args: {
    title: 'Serendipity',
    description: '意外發現珍奇事物的能力；機緣湊巧。'
  },
  render: (args) => ({
    props: args,
    template:
      '<div class="bg-background-light dark:bg-background-dark p-4 max-w-md">'
      + '<fm-card-list-item [title]="title" [description]="description"></fm-card-list-item>'
      + '</div>'
  })
};

export default meta;

type Story = StoryObj<FmCardListItemComponent>;

export const 預設: Story = {};

export const 長內容: Story = {
  args: {
    title: 'Resilience',
    description: '韌性；彈性；恢復力。面對挫折仍能快速復原並持續前進。'
  }
};
