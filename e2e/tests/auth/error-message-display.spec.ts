// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('UI/UX 與使用者體驗', () => {
  test('錯誤訊息顯示與清除', async ({ page, request }) => {
    const testEmail = 'test-error-message@example.com';
    const testPassword = 'password123456';

    // 前置條件：建立測試帳號
    await request.post('http://localhost:3280/auth/register', {
      data: {
        email: testEmail,
        password: testPassword
      }
    });

    // 1. 前往登入頁面 /login
    await page.goto('/login');

    // 2. 輸入錯誤的帳密並提交
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('密碼').fill('wrongpassword');
    await page.getByTestId('login-submit').click();

    // 3. 驗證頁面顯示錯誤訊息
    await expect(page.getByText('Email 或密碼錯誤')).toBeVisible();

    // 4. 修正 Email 和密碼為正確值
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('密碼').fill(testPassword);

    // 5. 再次點擊「登入」按鈕
    await page.getByTestId('login-submit').click();

    // 驗證第二次提交前錯誤訊息自動清除
    // 驗證第二次提交成功後導向 /decks
    await expect(page).toHaveURL('/decks', { timeout: 10000 });
    
    // 驗證不顯示任何錯誤訊息
    await expect(page.getByText('Email 或密碼錯誤')).not.toBeVisible();
  });
});
