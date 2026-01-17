// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('UI/UX 與使用者體驗', () => {
  test('登入載入狀態 UI 回饋', async ({ page, request }) => {
    const testEmail = 'test-loading-login@example.com';
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

    // 2. 填寫登入資訊
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('密碼').fill(testPassword);

    // 3. 點擊「登入」按鈕
    await page.getByTestId('login-submit').click();

    // 4. 在 API 回應前觀察按鈕狀態
    // 驗證按鈕文字變更為「登入中...」
    await expect(page.getByRole('button', { name: '登入中...' })).toBeVisible();

    // 驗證登入成功後按鈕恢復正常並導向頁面
    await expect(page).toHaveURL('/decks', { timeout: 10000 });
  });
});
