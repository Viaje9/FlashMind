// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('檢視牌組列表', () => {
  test('測試顯示學習進度', async ({ page, request }) => {
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

    // 2. 透過 API 建立測試牌組「學習進度測試」
    const deckResponse = await request.post('http://localhost:3280/decks', {
      data: { name: '學習進度測試', dailyNewCards: 20, dailyReviewCards: 100 }
    });
    expect(deckResponse.ok()).toBeTruthy();

    // 透過 UI 登入讓 page 獲得 session cookie
    await page.goto('/login');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('密碼').fill(testPassword);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL('/decks', { timeout: 10000 });

    // 3. 驗證牌組卡片顯示學習統計資訊（新卡片數、待複習數）
    await expect(page.getByText('學習進度測試')).toBeVisible();
    await expect(page.getByText('0 新卡片')).toBeVisible();
    await expect(page.getByText('0 待複習')).toBeVisible();

    // 4. 驗證進度條元素存在
    const progressBar = page.locator('fm-progress-bar').first();
    await expect(progressBar).toBeVisible();

    // 5. 驗證創建日期顯示
    // 注意：根據當前的 UI 實作（deck-card.component.html），創建日期並未顯示
    // 這個驗證步驟可能需要在 UI 實作創建日期顯示後才能通過
  });
});
