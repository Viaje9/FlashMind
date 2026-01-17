import type { Meta, StoryObj } from '@storybook/angular';
import { FmProfileCardComponent } from './profile-card.component';

const meta: Meta<FmProfileCardComponent> = {
  title: '分子元件/個人資料卡',
  component: FmProfileCardComponent,
  args: {
    name: '王小明',
    email: 'xiaoming@example.com',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCbYOzCPpw8JGpXzI07tYV1BZcE3ODMp_2KFt8_PFd7AK2Kcov8vl1Xcp_MDw1vc7W94-bJiaM8cCoZ_fETUvBKiz8s3NmikqB3-xuKeXnunc06dUJSu92uhG-OUuw8QeKWk_-LG1pO_rh_h6l6spEVhw1X0grEq9LuU_QU2NOnCRRcSeGG9CbTTONjPKBaC6tyL3oEgvB9vrz3QuAzWsE89c_7Lv_yPwgqe119SER3YJEDDiFlSyrqmCLLjwq03K4mSF2jrdD9DVs',
    actionLabel: '管理帳戶',
    showEditIndicator: true
  },
  render: (args) => ({
    props: args,
    template:
      '<div class="bg-background-light dark:bg-background-dark p-4">'
      + '<fm-profile-card [name]="name" [email]="email" [avatarUrl]="avatarUrl" [actionLabel]="actionLabel" [showEditIndicator]="showEditIndicator"></fm-profile-card>'
      + '</div>'
  })
};

export default meta;

type Story = StoryObj<FmProfileCardComponent>;

export const 預設: Story = {};

export const 無頭像: Story = {
  args: {
    avatarUrl: '',
    showEditIndicator: false
  }
};
