// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('登出功能', () => {
  test('登出後無法存取受保護頁面', async ({ page, request }) => {
    const testEmail = 'test-logout-redirect@example.com';
    const testPassword = 'password123456';

    // 前置條件：建立測試帳號並登入
    await request.post('http://localhost:3280/auth/register', {
      data: {
        email: testEmail,
        password: testPassword
      }
    });

    await page.goto('/login');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('密碼').fill(testPassword);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL('/decks', { timeout: 10000 });

    // 登出
    await page.goto('/settings');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.getByRole('button', { name: '登出帳戶' }).click();
    await expect(page).toHaveURL('/welcome', { timeout: 10000 });

    // 1. 手動導向至 /decks 頁面（受保護路由）
    await page.goto('/decks');

    // 2. 前端 AuthGuard 攔截請求
    // 驗證自動導向至 /login 頁面
    await expect(page).toHaveURL('/login', { timeout: 10000 });

    // 驗證頁面顯示登入表單
    await expect(page.getByText('登入帳號')).toBeVisible();
  });
});
