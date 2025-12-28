import type { Meta, StoryObj } from '@storybook/angular';
import { FmWelcomeHeroComponent } from './welcome-hero.component';

const meta: Meta<FmWelcomeHeroComponent> = {
  title: '組合元件/歡迎區塊',
  component: FmWelcomeHeroComponent,
  args: {
    title: 'FlashMind',
    description: '建立、學習、記憶。\n讓知識累積變得前所未有的簡單。',
    badgeText: '每日學習',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAimu0K5ZYfhuA0FIilBOXDDibIPQxWPairVJc1tpdC8POb6o4xXOnbczkxUQOLakUMCNjm_ppjsmWhDnbjvk7cB7D_PxWJgi7l1_znhMU6hk0cPOAPqDmrSgOhsixzGlodT5rhNs9vfGU2IU85UMDSj22XFhPEFceEvd5u9RSyzSdsQQYmUIR3_nLCXMJ7fUAVK-l32AAmMWQ7wPlXzW3U5_2yoD3j-OEheF1EMCAhEyobgFBjeuyKCVnssFy804beQNuFXj-QXOs'
  },
  render: (args) => ({
    props: args,
    template:
      '<div class="bg-background-light dark:bg-background-dark p-6 max-w-md">'
      + '<fm-welcome-hero [title]="title" [description]="description" [badgeText]="badgeText" [imageUrl]="imageUrl"></fm-welcome-hero>'
      + '</div>'
  })
};

export default meta;

type Story = StoryObj<FmWelcomeHeroComponent>;

export const 預設: Story = {};

export const 無圖片: Story = {
  args: {
    imageUrl: ''
  }
};
