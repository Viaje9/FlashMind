import type { Meta, StoryObj } from '@storybook/angular';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FmToggleComponent } from './toggle.component';

const meta: Meta<FmToggleComponent> = {
  title: '基礎元件/切換開關',
  component: FmToggleComponent,
  args: {
    ariaLabel: '啟用設定'
  },
  render: (args) => ({
    props: {
      ...args,
      control: new FormControl(true)
    },
    moduleMetadata: {
      imports: [ReactiveFormsModule]
    },
    template: '<fm-toggle [formControl]="control" [ariaLabel]="ariaLabel"></fm-toggle>'
  })
};

export default meta;

type Story = StoryObj<FmToggleComponent>;

export const 開啟: Story = {};

export const 關閉: Story = {
  render: (args) => ({
    props: {
      ...args,
      control: new FormControl(false)
    },
    moduleMetadata: {
      imports: [ReactiveFormsModule]
    },
    template: '<fm-toggle [formControl]="control" [ariaLabel]="ariaLabel"></fm-toggle>'
  })
};

export const 停用: Story = {
  render: (args) => ({
    props: {
      ...args,
      control: new FormControl({ value: true, disabled: true })
    },
    moduleMetadata: {
      imports: [ReactiveFormsModule]
    },
    template: '<fm-toggle [formControl]="control" [ariaLabel]="ariaLabel"></fm-toggle>'
  })
};
