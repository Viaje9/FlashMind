import type { Meta, StoryObj } from '@storybook/angular';
import { FmIconButtonComponent } from '../../primitives/icon-button/icon-button.component';
import { FmPageHeaderComponent } from './page-header.component';

const meta: Meta<FmPageHeaderComponent> = {
  title: '分子元件/頁首',
  component: FmPageHeaderComponent,
  args: {
    title: '牌組列表',
    subtitle: '',
    layout: 'start',
    sticky: false,
    dense: false
  },
  argTypes: {
    layout: {
      control: 'select',
      options: ['start', 'center']
    }
  },
  render: (args) => ({
    props: args,
    imports: [FmIconButtonComponent],
    template:
      '<div class="bg-background-light dark:bg-background-dark p-4">'
      + '<fm-page-header [title]="title" [subtitle]="subtitle" [layout]="layout" [sticky]="sticky" [dense]="dense">'
      + '<fm-icon-button slot="left" variant="ghost" ariaLabel="返回">'
      + '<span class="material-symbols-outlined">arrow_back</span>'
      + '</fm-icon-button>'
      + '<fm-icon-button slot="right" variant="ghost" ariaLabel="設定">'
      + '<span class="material-symbols-outlined">settings</span>'
      + '</fm-icon-button>'
      + '</fm-page-header>'
      + '</div>'
  })
};

export default meta;

type Story = StoryObj<FmPageHeaderComponent>;

export const 預設: Story = {};

export const 置中: Story = {
  args: {
    title: '基礎單字',
    subtitle: '日常對話',
    layout: 'center'
  }
};
