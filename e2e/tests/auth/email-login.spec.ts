// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('Email 登入功能', () => {
  test('成功使用 Email 登入', async ({ page, request }) => {
    // 使用時間戳確保每次測試使用唯一 email
    const testEmail = `test-login-${Date.now()}@example.com`;
    const testPassword = 'password123456';

    // 前置條件：在資料庫建立測試帳號
    const registerResponse = await request.post('http://localhost:3280/auth/register', {
      data: {
        email: testEmail,
        password: testPassword
      }
    });
    // 確保註冊成功
    expect(registerResponse.ok()).toBeTruthy();

    // 1. 前往登入頁面 /login
    await page.goto('/login');

    // 2. 驗證頁面顯示「登入帳號」標題
    await expect(page.getByText('登入帳號')).toBeVisible();

    // 3. 在 Email 欄位輸入 test@example.com
    await page.getByLabel('Email').fill(testEmail);

    // 4. 在密碼欄位輸入 password123456
    await page.getByLabel('密碼').fill(testPassword);

    // 5. 確認「記住我」勾選框未勾選
    await expect(page.getByTestId('login-remember-me')).not.toBeChecked();

    // 6. 點擊「登入」按鈕
    await page.getByTestId('login-submit').click();

    // 7. 等待登入請求完成
    await expect(page).toHaveURL('/decks', { timeout: 10000 });
  });
});
