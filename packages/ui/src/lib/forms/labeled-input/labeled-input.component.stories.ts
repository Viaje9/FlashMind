import type { Meta, StoryObj } from '@storybook/angular';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FmLabeledInputComponent } from './labeled-input.component';

const meta: Meta<FmLabeledInputComponent> = {
  title: '表單/標籤輸入框',
  component: FmLabeledInputComponent,
  args: {
    label: '牌組名稱',
    placeholder: '例如：日文 N5 單字',
    icon: 'style',
    type: 'text'
  },
  render: (args) => ({
    props: {
      ...args,
      control: new FormControl('')
    },
    moduleMetadata: {
      imports: [ReactiveFormsModule]
    },
    template:
      '<div class="bg-background-light dark:bg-background-dark p-4">' +
      '<fm-labeled-input [formControl]="control" [label]="label" [placeholder]="placeholder" [icon]="icon" [type]="type"></fm-labeled-input>' +
      '</div>'
  })
};

export default meta;

type Story = StoryObj<FmLabeledInputComponent>;

export const 空白: Story = {};

export const 有內容: Story = {
  render: (args) => ({
    props: {
      ...args,
      control: new FormControl('托福核心單字')
    },
    moduleMetadata: {
      imports: [ReactiveFormsModule]
    },
    template:
      '<div class="bg-background-light dark:bg-background-dark p-4">' +
      '<fm-labeled-input [formControl]="control" [label]="label" [placeholder]="placeholder" [icon]="icon" [type]="type"></fm-labeled-input>' +
      '</div>'
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
    template:
      '<div class="bg-background-light dark:bg-background-dark p-4">' +
      '<fm-labeled-input [formControl]="control" [label]="label" [placeholder]="placeholder" [icon]="icon" [type]="type"></fm-labeled-input>' +
      '</div>'
  })
};
