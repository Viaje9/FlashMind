// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('登出功能', () => {
  test('登出時顯示載入狀態', async ({ page, request }) => {
    const testEmail = 'test-logout-loading@example.com';
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

    // 1. 前往設定頁面 /settings
    await page.goto('/settings');

    // 2. 捲動至頁面底部
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // 3. 攔截 logout API，加入延遲讓測試有時間觀察 loading 狀態
    await page.route('**/auth/logout', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill({ status: 204 });
    });

    // 4. 點擊「登出帳戶」按鈕
    const logoutButton = page.getByRole('button', { name: '登出帳戶' });
    await logoutButton.click();

    // 5. 在 API 回應前觀察按鈕狀態
    // 驗證按鈕文字變更為「登出中...」
    await expect(page.getByRole('button', { name: '登出中...' })).toBeVisible();

    // 驗證登出完成後導向歡迎頁面
    await expect(page).toHaveURL('/welcome', { timeout: 10000 });
  });
});
