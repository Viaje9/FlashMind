// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('檢視牌組列表', () => {
  test('測試顯示牌組列表', async ({ page, request }) => {
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

    // 2. 透過 API 建立 3 個測試牌組
    const deckNames = ['日文 N5 單字', '英文托福', '數學公式'];

    for (const name of deckNames) {
      const deckResponse = await request.post('http://localhost:3280/decks', {
        data: { name, dailyNewCards: 20, dailyReviewCards: 100 }
      });
      expect(deckResponse.ok()).toBeTruthy();
    }

    // 透過 UI 登入讓 page 獲得 session cookie
    await page.goto('/login');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('密碼').fill(testPassword);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL('/decks', { timeout: 10000 });

    // 3. 導航至 /decks（已經在登入後自動導向）

    // 4. 驗證頁面標題顯示「FlashMind」
    await expect(page.getByRole('heading', { name: 'FlashMind', level: 1 })).toBeVisible();

    // 5. 驗證搜尋框顯示並有正確的 placeholder「搜尋牌組...」
    await expect(page.getByRole('textbox', { name: '搜尋牌組' })).toBeVisible();
    await expect(page.getByPlaceholder('搜尋牌組...')).toBeVisible();

    // 6. 驗證 3 個牌組都顯示在列表中
    // 7. 驗證每個牌組卡片顯示牌組名稱
    for (const name of deckNames) {
      await expect(page.getByText(name)).toBeVisible();
    }

    // 8. 驗證新增牌組按鈕（+ 圖示）顯示在右下角
    await expect(page.getByRole('button', { name: '新增牌組' })).toBeVisible();
  });
});
