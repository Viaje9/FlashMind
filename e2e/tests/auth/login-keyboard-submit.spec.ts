// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('UI/UX 與使用者體驗', () => {
  test('登入表單 Enter 鍵提交', async ({ page, request }) => {
    const testEmail = 'test-keyboard-login@example.com';
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

    // 2. 在 Email 欄位輸入 test@example.com
    await page.getByLabel('Email').fill(testEmail);

    // 3. 在密碼欄位輸入 password123456
    await page.getByLabel('密碼').fill(testPassword);

    // 4. 在密碼欄位中按下 Enter 鍵
    await page.getByLabel('密碼').press('Enter');

    // 驗證表單自動提交
    // 驗證觸發登入 API 請求
    // 驗證成功登入並導向 /decks
    await expect(page).toHaveURL('/decks', { timeout: 10000 });
  });
});
