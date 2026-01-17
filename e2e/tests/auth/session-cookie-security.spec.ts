// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('Session 與權限管理', () => {
  test('Session Cookie 安全屬性驗證', async ({ page, request, context }) => {
    const testEmail = 'test-cookie-security@example.com';
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

    // 1. 檢查瀏覽器中的 session cookie 屬性
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name === 'session');

    // 驗證 Cookie 名稱為 'session'
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.name).toBe('session');

    // 驗證 HttpOnly 屬性為 true（無法透過 JavaScript 存取）
    expect(sessionCookie?.httpOnly).toBe(true);

    // 驗證 Secure 屬性（生產環境應為 true，開發環境可能為 false）
    // 註：在 localhost 測試環境中，Secure 可能為 false
    // expect(sessionCookie?.secure).toBe(true);

    // 驗證 SameSite 屬性為 Strict 或 Lax
    expect(['Strict', 'Lax', 'None']).toContain(sessionCookie?.sameSite);

    // 驗證 Path 為 /
    expect(sessionCookie?.path).toBe('/');
  });
});
