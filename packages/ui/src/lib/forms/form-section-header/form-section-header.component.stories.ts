import type { Meta, StoryObj } from '@storybook/angular';
import { FmFormSectionHeaderComponent } from './form-section-header.component';

const meta: Meta<FmFormSectionHeaderComponent> = {
  title: '表單/區塊標題',
  component: FmFormSectionHeaderComponent,
  args: {
    title: '正面',
    icon: 'web_stories'
  },
  render: (args) => ({
    props: args,
    template:
      '<div class="bg-background-light dark:bg-background-dark p-4">'
      + '<fm-form-section-header [title]="title" [icon]="icon">'
      + '<button slot="action" type="button" class="text-primary text-sm font-bold">編輯</button>'
      + '</fm-form-section-header>'
      + '</div>'
  })
};

export default meta;

type Story = StoryObj<FmFormSectionHeaderComponent>;

export const 預設: Story = {};

export const 無圖示: Story = {
  args: {
    icon: ''
  }
};
