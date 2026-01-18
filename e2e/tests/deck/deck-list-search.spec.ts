// spec: 檢視牌組列表 - 測試搜尋牌組功能
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('檢視牌組列表', () => {
  test('測試搜尋牌組功能', async ({ page, request }) => {
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

    // 2. 透過 API 建立 5 個測試牌組
    const deckNames = ['日文 N5 單字', '日文 N4 單字', '英文托福', '數學公式', '物理定理'];

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

    // 3. 驗證所有 5 個牌組都顯示
    for (const name of deckNames) {
      await expect(page.getByText(name)).toBeVisible();
    }

    // 4. 在搜尋框輸入「日文」
    const searchInput = page.getByRole('textbox', { name: '搜尋牌組' });
    await searchInput.fill('日文');

    // 5. 驗證只顯示包含「日文」的牌組（2 個）
    await expect(page.getByText('日文 N5 單字')).toBeVisible();
    await expect(page.getByText('日文 N4 單字')).toBeVisible();
    await expect(page.getByText('英文托福')).not.toBeVisible();
    await expect(page.getByText('數學公式')).not.toBeVisible();
    await expect(page.getByText('物理定理')).not.toBeVisible();

    // 6. 清空搜尋框
    await searchInput.clear();

    // 7. 驗證所有牌組再次顯示（5 個）
    for (const name of deckNames) {
      await expect(page.getByText(name)).toBeVisible();
    }

    // 8. 在搜尋框輸入「不存在的牌組」
    await searchInput.fill('不存在的牌組');

    // 9. 驗證顯示無搜尋結果的提示
    await expect(page.getByText('尚無牌組')).toBeVisible();
  });
});
