import type { Meta, StoryObj } from '@storybook/angular';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FmSearchInputComponent } from './search-input.component';

const meta: Meta<FmSearchInputComponent> = {
  title: '基礎元件/搜尋輸入',
  component: FmSearchInputComponent,
  args: {
    placeholder: '搜尋牌組...',
    ariaLabel: '搜尋'
  },
  render: (args) => ({
    props: {
      ...args,
      control: new FormControl('')
    },
    moduleMetadata: {
      imports: [ReactiveFormsModule]
    },
    template: '<fm-search-input [formControl]="control" [placeholder]="placeholder" [ariaLabel]="ariaLabel"></fm-search-input>'
  })
};

export default meta;

type Story = StoryObj<FmSearchInputComponent>;

export const 空白: Story = {};

export const 有內容: Story = {
  render: (args) => ({
    props: {
      ...args,
      control: new FormControl('英文')
    },
    moduleMetadata: {
      imports: [ReactiveFormsModule]
    },
    template: '<fm-search-input [formControl]="control" [placeholder]="placeholder" [ariaLabel]="ariaLabel"></fm-search-input>'
  })
};

export const 停用: Story = {
  render: (args) => ({
    props: {
      ...args,
      control: new FormControl({ value: '', disabled: true })
    },
    moduleMetadata: {
      imports: [ReactiveFormsModule]
    },
    template: '<fm-search-input [formControl]="control" [placeholder]="placeholder" [ariaLabel]="ariaLabel"></fm-search-input>'
  })
};
