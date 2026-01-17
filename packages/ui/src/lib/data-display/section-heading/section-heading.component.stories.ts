import type { Meta, StoryObj } from '@storybook/angular';
import { FmSectionHeadingComponent } from './section-heading.component';

const meta: Meta<FmSectionHeadingComponent> = {
  title: '分子元件/區段標題',
  component: FmSectionHeadingComponent,
  args: {
    text: '學習偏好',
    padded: true
  }
};

export default meta;

type Story = StoryObj<FmSectionHeadingComponent>;

export const 預設: Story = {};

export const 無邊距: Story = {
  args: {
    padded: false
  }
};
