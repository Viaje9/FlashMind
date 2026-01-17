// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('Email 註冊功能', () => {
  test('註冊時 Email 已被使用（409 錯誤）', async ({ page, request }) => {
    const testEmail = 'existing@example.com';
    const testPassword = 'password123456';

    // 前置條件：在資料庫建立測試帳號
    await request.post('http://localhost:3280/auth/register', {
      data: {
        email: testEmail,
        password: testPassword
      }
    });

    // 1. 前往註冊頁面 /register
    await page.goto('/register');

    // 2. 在 Email 欄位輸入 existing@example.com
    await page.getByTestId('register-email').fill(testEmail);

    // 3. 在密碼欄位輸入 password123456
    await page.getByTestId('register-password').fill(testPassword);

    // 4. 在確認密碼欄位輸入 password123456
    await page.getByTestId('register-confirm-password').fill(testPassword);

    // 5. 點擊「註冊」按鈕
    await page.getByTestId('register-submit').click();

    // 6. 等待 API 回應並驗證錯誤訊息
    await expect(page.getByText('此 Email 已被註冊')).toBeVisible();
    
    // 驗證使用者停留在 /register 頁面
    await expect(page).toHaveURL('/register');
  });
});
