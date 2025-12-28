import type { Meta, StoryObj } from '@storybook/angular';
import { FmSettingRowComponent } from './setting-row.component';

const meta: Meta<FmSettingRowComponent> = {
  title: '分子元件/設定列',
  component: FmSettingRowComponent,
  args: {
    icon: 'notifications_active',
    iconClass: 'bg-blue-500/10 text-blue-500',
    label: '每日學習提醒',
    description: '',
    value: '',
    variant: 'toggle',
    checked: true,
    disabled: false
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['toggle', 'link', 'action']
    }
  }
};

export default meta;

type Story = StoryObj<FmSettingRowComponent>;

export const 切換: Story = {};

export const 連結: Story = {
  args: {
    variant: 'link',
    icon: 'schedule',
    iconClass: 'bg-primary/10 text-primary',
    label: '提醒時間',
    value: '20:00'
  }
};

export const 動作: Story = {
  args: {
    variant: 'action',
    icon: 'download',
    iconClass: 'bg-teal-500/10 text-teal-500',
    label: '匯出學習數據'
  }
};
