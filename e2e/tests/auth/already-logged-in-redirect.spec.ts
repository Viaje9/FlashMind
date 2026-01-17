// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('Session 與權限管理', () => {
  test('已登入時存取登入頁面自動導向主頁', async ({ page, request }) => {
    const uniqueId = Date.now();
    const testEmail = `test-already-logged-in-${uniqueId}@example.com`;
    const testPassword = 'password123456';

    // 前置條件：建立測試帳號
    const registerResponse = await request.post('http://localhost:3280/auth/register', {
      data: {
        email: testEmail,
        password: testPassword
      }
    });
    expect(registerResponse.ok()).toBeTruthy();

    await page.goto('/login');
    await page.getByTestId('login-email').fill(testEmail);
    await page.getByTestId('login-password').fill(testPassword);

    // 等待登入請求並驗證成功
    const [loginResponse] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/auth/login') && resp.request().method() === 'POST'),
      page.getByTestId('login-submit').click()
    ]);
    expect(loginResponse.ok()).toBeTruthy();

    await expect(page).toHaveURL('/decks', { timeout: 10000 });

    // 1. 手動導向至 /login 頁面
    await page.goto('/login');

    // 2. 前端檢查認證狀態
    // 驗證自動導向至 /decks 頁面
    await expect(page).toHaveURL('/decks', { timeout: 10000 });
  });
});
