// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('檢視牌組列表', () => {
  test('測試開始學習入口', async ({ page, request }) => {
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

    // 2. 透過 API 建立測試牌組「學習入口測試」
    const deckResponse = await request.post('http://localhost:3280/decks', {
      data: { name: '學習入口測試', dailyNewCards: 20, dailyReviewCards: 100 }
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

    // 3. 驗證牌組列表頁面已載入
    await expect(page.getByRole('heading', { name: 'FlashMind', level: 1 })).toBeVisible();
    await expect(page.getByText('學習入口測試')).toBeVisible();

    // 4. 點擊牌組卡片
    await page.getByText('學習入口測試').click();

    // 5. 驗證導航至牌組詳情頁 /decks/:id
    await expect(page).toHaveURL(`/decks/${deckId}`, { timeout: 10000 });

    // 6. 驗證詳情頁顯示正確的牌組名稱
    await expect(page.getByRole('heading', { name: '學習入口測試', level: 1 })).toBeVisible();
  });
});
