// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('Google OAuth 登入功能', () => {
  test('從登入頁面發起 Google OAuth 登入（勾選記住我）', async ({ page }) => {
    // 1. 前往登入頁面 /login
    await page.goto('/login');

    // 2. 勾選「記住我」勾選框（使用 force 因為有覆蓋層）
    const rememberMeCheckbox = page.getByTestId('login-remember-me');
    await rememberMeCheckbox.click({ force: true });

    // 3. 驗證勾選框狀態為已勾選
    await expect(rememberMeCheckbox).toBeChecked();

    // 4. 點擊 Google 登入按鈕
    const googleButton = page.getByRole('button', { name: /Google/i });
    await googleButton.click();

    // 驗證瀏覽器導向至 /auth/google?rememberMe=true
    await page.waitForURL(/auth\/google/, { timeout: 5000 });
  });
});
