// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('Email 登入功能', () => {
  test('登入時 Email 不存在（401 錯誤）', async ({ page }) => {
    // 1. 前往登入頁面 /login
    await page.goto('/login');

    // 2. 在 Email 欄位輸入 nonexistent@example.com（不存在的 Email）
    await page.getByLabel('Email').fill('nonexistent@example.com');

    // 3. 在密碼欄位輸入 anypassword123
    await page.getByLabel('密碼').fill('anypassword123');

    // 4. 點擊「登入」按鈕
    await page.getByTestId('login-submit').click();

    // 5. 等待 API 回應並驗證錯誤訊息
    await expect(page.getByText('Email 或密碼錯誤')).toBeVisible();
    
    // 驗證使用者停留在 /login 頁面
    await expect(page).toHaveURL('/login');
  });

  test('登入時密碼錯誤（401 錯誤）', async ({ page, request }) => {
    const testEmail = 'test-wrong-password@example.com';
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

    // 3. 在密碼欄位輸入 wrongpassword（錯誤密碼）
    await page.getByLabel('密碼').fill('wrongpassword');

    // 4. 點擊「登入」按鈕
    await page.getByTestId('login-submit').click();

    // 5. 等待 API 回應並驗證錯誤訊息
    await expect(page.getByText('Email 或密碼錯誤')).toBeVisible();
    
    // 驗證使用者停留在 /login 頁面
    await expect(page).toHaveURL('/login');
  });
});
