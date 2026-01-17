// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('Email 登入功能', () => {
  test('登入時勾選「記住我」選項', async ({ page, request }) => {
    const testEmail = 'test-remember@example.com';
    const testPassword = 'password123456';

    // 前置條件：在資料庫建立測試帳號
    await request.post('http://localhost:3280/auth/register', {
      data: {
        email: testEmail,
        password: testPassword
      }
    });

    // 1. 前往登入頁面 /login
    await page.goto('/login');

    // 2. 在 Email 欄位輸入 test@example.com
    await page.getByLabel('Email').fill(testEmail);

    // 3. 在密碼欄位輸入 password123456
    await page.getByLabel('密碼').fill(testPassword);

    // 4. 勾選「記住我」勾選框（使用 force 因為有覆蓋層）
    const rememberMeCheckbox = page.getByTestId('login-remember-me');
    await rememberMeCheckbox.click({ force: true });

    // 5. 驗證勾選框狀態為已勾選
    await expect(page.getByTestId('login-remember-me')).toBeChecked();

    // 6. 點擊「登入」按鈕
    await page.getByTestId('login-submit').click();

    // 7. 等待登入請求完成
    await expect(page).toHaveURL('/decks', { timeout: 10000 });
  });
});
