// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('編輯牌組設定', () => {
  test('測試設定頁面的返回按鈕', async ({ page, request }) => {
    // 1. 使用 API 建立測試帳號並登入
    const testEmail = `test-${Date.now()}@test.com`;
    const testPassword = 'Test1234!';

    // 用 request 註冊帳號
    const registerResponse = await request.post('http://localhost:3280/auth/register', {
      data: { email: testEmail, password: testPassword }
    });
    expect(registerResponse.ok()).toBeTruthy();

    // 用 request 登入（讓 request context 有 cookie）
    const loginResponse = await request.post('http://localhost:3280/auth/login', {
      data: { email: testEmail, password: testPassword }
    });
    expect(loginResponse.ok()).toBeTruthy();

    // 2. 透過 API 建立測試牌組「返回按鈕測試」
    const deckResponse = await request.post('http://localhost:3280/decks', {
      data: { name: '返回按鈕測試', dailyNewCards: 20, dailyReviewCards: 100 }
    });
    expect(deckResponse.ok()).toBeTruthy();
    const deckData = await deckResponse.json();
    const deckId = deckData.data.id;

    // 透過 UI 登入讓 page 獲得 session cookie
    await page.goto('/login');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('密碼').fill(testPassword);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL('/decks', { timeout: 10000 });

    // 3. 導航至牌組設定頁
    await page.goto(`/decks/${deckId}/settings`);
    await expect(page.getByRole('heading', { name: '牌組設定', level: 1 })).toBeVisible();

    // 4. 點擊左上角返回按鈕
    await page.getByRole('button', { name: '返回' }).click();

    // 5. 驗證導航回牌組詳情頁 /decks/:id
    await expect(page).toHaveURL(`/decks/${deckId}`);
  });
});
