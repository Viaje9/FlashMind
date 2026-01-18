// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('建立新牌組', () => {
  test('測試返回按鈕功能', async ({ page, request }) => {
    // 1. 使用 API 建立測試帳號並登入
    const testEmail = `test-${Date.now()}@test.com`;
    const testPassword = 'Test1234!';

    // 用 request 註冊帳號
    const registerResponse = await request.post('http://localhost:3280/auth/register', {
      data: { email: testEmail, password: testPassword }
    });
    expect(registerResponse.ok()).toBeTruthy();

    // 透過 UI 登入讓 page 獲得 session cookie
    await page.goto('/login');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('密碼').fill(testPassword);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL('/decks', { timeout: 10000 });

    // 2. 導航至 /decks/new
    await page.goto('/decks/new');

    // 3. 在牌組名稱輸入框輸入「測試返回」
    await page.getByRole('textbox', { name: '牌組名稱' }).fill('測試返回');

    // 4. 點擊左上角返回按鈕（arrow_back icon）
    await page.getByRole('button', { name: '返回' }).click();

    // 5. 驗證導航回牌組列表頁 /decks
    await expect(page).toHaveURL('/decks');

    // 6. 驗證牌組列表中不包含「測試返回」
    await expect(page.getByText('尚無牌組')).toBeVisible();
  });
});
