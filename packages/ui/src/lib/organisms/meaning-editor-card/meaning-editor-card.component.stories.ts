import type { Meta, StoryObj } from '@storybook/angular';
import { FmMeaningEditorCardComponent } from './meaning-editor-card.component';

const meta: Meta<FmMeaningEditorCardComponent> = {
  title: '組合元件/詞義編輯卡',
  component: FmMeaningEditorCardComponent,
  args: {
    tagLabel: '你好',
    showDelete: true,
    meaning: {
      zhMeaning: '你好',
      enExample: 'Hello, how are you today?',
      zhExample: '你好，你今天好嗎？'
    }
  },
  render: (args) => ({
    props: args,
    template:
      '<div class="bg-background-light dark:bg-background-dark p-4 max-w-md">'
      + '<fm-meaning-editor-card [meaning]="meaning" [tagLabel]="tagLabel" [showDelete]="showDelete"></fm-meaning-editor-card>'
      + '</div>'
  })
};

export default meta;

type Story = StoryObj<FmMeaningEditorCardComponent>;

export const 預設: Story = {};

export const 無標籤: Story = {
  args: {
    tagLabel: ''
  }
};
