import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const webRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@flashmind\/ui$/,
        replacement: resolve(webRoot, '../../packages/ui/src/index.ts'),
      },
      {
        find: /^@flashmind\/ui\/(.*)$/,
        replacement: resolve(webRoot, '../../packages/ui/src/$1'),
      },
      {
        find: /^@flashmind\/api-client$/,
        replacement: resolve(webRoot, '../../packages/api-client/src/generated/index.ts'),
      },
      {
        find: /^@flashmind\/api-client\/(.*)$/,
        replacement: resolve(webRoot, '../../packages/api-client/src/generated/$1'),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test-setup.ts'],
  },
});
