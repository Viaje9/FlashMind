// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('登出功能', () => {
  test('從設定頁面登出', async ({ page, request }) => {
    const testEmail = 'test-logout@example.com';
    const testPassword = 'password123456';

    // 前置條件：建立測試帳號並登入
    await request.post('http://localhost:3280/auth/register', {
      data: {
        email: testEmail,
        password: testPassword
      }
    });

    // 登入
    await page.goto('/login');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('密碼').fill(testPassword);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL('/decks', { timeout: 10000 });

    // 1. 前往設定頁面 /settings
    await page.goto('/settings');

    // 2. 驗證頁面顯示使用者資訊
    await expect(page.getByText(testEmail)).toBeVisible();

    // 3. 捲動至頁面底部
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // 4. 驗證「登出帳戶」按鈕存在
    const logoutButton = page.getByRole('button', { name: '登出帳戶' });
    await expect(logoutButton).toBeVisible();

    // 5. 點擊「登出帳戶」按鈕
    await logoutButton.click();

    // 6. 等待登出請求完成
    // 驗證成功導向至 /welcome 歡迎頁面
    await expect(page).toHaveURL('/welcome', { timeout: 10000 });
  });
});
