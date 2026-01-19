import type { Meta, StoryObj } from '@storybook/angular';
import { FmStudyCardComponent } from './study-card.component';

const meta: Meta<FmStudyCardComponent> = {
  title: '組合元件/學習卡片',
  component: FmStudyCardComponent,
  args: {
    word: 'Hello',
    translations: ['你好', '喂'],
    examples: [
      {
        label: '你好',
        sentence: 'Hello, how are you today?',
        translation: '你好，你今天好嗎？'
      },
      {
        label: '喂',
        sentence: 'Hello? Is anyone there?',
        translation: '喂？有人在嗎？'
      }
    ],
    showActions: true
  },
  render: (args) => ({
    props: args,
    template:
      '<div class="bg-background-light dark:bg-background-dark p-4 max-w-md">'
      + '<fm-study-card [word]="word" [translations]="translations" [examples]="examples" [showActions]="showActions"></fm-study-card>'
      + '</div>'
  })
};

export default meta;

type Story = StoryObj<FmStudyCardComponent>;

export const 預設: Story = {};

export const 無例句: Story = {
  args: {
    translations: ['你好'],
    examples: []
  }
};
