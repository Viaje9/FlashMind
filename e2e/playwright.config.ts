import { defineConfig, devices } from '@playwright/test';

/**
 * FlashMind E2E 測試配置
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: '.',
  /* 每個測試的最大執行時間 */
  timeout: 30 * 1000,
  /* 每個斷言的最大等待時間 */
  expect: {
    timeout: 5000,
  },
  /* 在 CI 環境中禁止使用 test.only */
  forbidOnly: !!process.env.CI,
  /* 在 CI 環境中重試失敗的測試 */
  retries: process.env.CI ? 2 : 0,
  /* 在 CI 環境中限制並行 worker 數量 */
  workers: process.env.CI ? 1 : undefined,
  /* 測試報告器 */
  reporter: 'html',
  /* 輸出目錄 */
  outputDir: './test-results',
  /* 所有專案共享的設定 */
  use: {
    /* 用於除錯的截圖和追蹤 */
    actionTimeout: 0,
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  /* 專案配置 */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* 在測試前啟動開發伺服器 */
  webServer: {
    command: 'pnpm dev:web',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    cwd: '..',
  },
});
