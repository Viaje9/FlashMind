// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('Google OAuth 登入功能', () => {
  test('從歡迎頁面發起 Google OAuth 登入', async ({ page }) => {
    // 1. 前往歡迎頁面 /welcome
    await page.goto('/welcome');

    // 2. 驗證頁面顯示「其他登入方式」區塊
    await expect(page.getByText('其他登入方式')).toBeVisible();

    // 3. 驗證 Google 登入按鈕存在
    const googleButton = page.getByRole('button', { name: /Google/i });
    await expect(googleButton).toBeVisible();

    // 4. 點擊 Google 登入按鈕
    // 註：實際測試環境可能需要 mock Google OAuth 流程
    // 此處僅驗證按鈕點擊會觸發正確的導航
    await googleButton.click();

    // 驗證瀏覽器嘗試導向 Google OAuth 端點
    // 在實際環境中，這會導向 /auth/google 然後重定向到 Google
    await page.waitForURL(/auth\/google/, { timeout: 5000 });
  });
});
