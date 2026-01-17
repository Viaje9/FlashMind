// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('Google OAuth 登入功能', () => {
  test('從登入頁面發起 Google OAuth 登入', async ({ page }) => {
    // 1. 前往登入頁面 /login
    await page.goto('/login');

    // 2. 驗證頁面顯示「或使用其他方式登入」分隔線
    await expect(page.getByText('或使用其他方式登入')).toBeVisible();

    // 3. 驗證 Google 登入按鈕存在
    const googleButton = page.getByRole('button', { name: /Google/i });
    await expect(googleButton).toBeVisible();

    // 4. 確認「記住我」勾選框未勾選
    await expect(page.getByTestId('login-remember-me')).not.toBeChecked();

    // 5. 點擊 Google 登入按鈕
    await googleButton.click();

    // 驗證瀏覽器導向至 /auth/google?rememberMe=false
    await page.waitForURL(/auth\/google/, { timeout: 5000 });
  });
});
