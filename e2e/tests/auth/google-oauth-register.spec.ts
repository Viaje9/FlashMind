// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('Google OAuth 登入功能', () => {
  test('從註冊頁面發起 Google OAuth 登入', async ({ page }) => {
    // 1. 前往註冊頁面 /register
    await page.goto('/register');

    // 2. 驗證頁面顯示「或使用其他方式註冊」分隔線
    await expect(page.getByText('或使用其他方式註冊')).toBeVisible();

    // 3. 驗證 Google 登入按鈕存在
    const googleButton = page.getByRole('button', { name: /Google/i });
    await expect(googleButton).toBeVisible();

    // 4. 點擊 Google 登入按鈕
    await googleButton.click();

    // 驗證瀏覽器導向至 /auth/google
    await page.waitForURL(/auth\/google/, { timeout: 5000 });
  });
});
