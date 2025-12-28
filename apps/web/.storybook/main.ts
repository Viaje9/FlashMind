import type { StorybookConfig } from '@storybook/angular';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const storybookDir = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: [
    '../src/**/*.stories.@(ts|tsx)',
    path.resolve(storybookDir, '../../../packages/ui/src/**/*.stories.@(ts|tsx)')
  ],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/angular',
    options: {}
  }
};

export default config;
