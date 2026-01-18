// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('刪除牌組', () => {
  test('測試刪除對話框點擊外部關閉', async ({ page, request }) => {
    // 1. 使用 API 建立測試帳號並登入
    const testEmail = `test-backdrop-${Date.now()}@test.com`;
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

    // 2. 透過 API 建立測試牌組「測試背景點擊」
    const deckResponse = await request.post('http://localhost:3280/decks', {
      data: { name: '測試背景點擊', dailyNewCards: 20, dailyReviewCards: 100 }
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

    // 驗證成功導航至設定頁面
    await expect(page).toHaveURL(`/decks/${deckId}/settings`);
    await expect(page.getByRole('heading', { name: '牌組設定', level: 1 })).toBeVisible();

    // 4. 點擊「刪除牌組」按鈕開啟確認對話框
    const deleteButton = page.getByRole('button', { name: '刪除牌組' });
    await deleteButton.scrollIntoViewIfNeeded();
    await deleteButton.click();

    // 驗證確認對話框顯示
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: '刪除牌組' })).toBeVisible();
    await expect(dialog.getByText('測試背景點擊')).toBeVisible();

    // 5. 點擊對話框外部的背景區域（backdrop）
    // 透過點擊 dialog 的父層 (backdrop) 來測試背景點擊
    await page.mouse.click(10, 10);

    // 6. 驗證對話框關閉（或保持開啟，取決於 UX 設計）
    // 根據一般 UX 實踐，點擊背景通常會關閉對話框
    await expect(dialog).not.toBeVisible();

    // 7. 驗證仍停留在設定頁面
    await expect(page).toHaveURL(`/decks/${deckId}/settings`);

    // 8. 驗證牌組未被刪除
    // 透過導航至列表頁確認牌組仍然存在
    await page.goto('/decks');
    const deckCard = page.getByRole('article').filter({ hasText: '測試背景點擊' });
    await expect(deckCard).toBeVisible();

    // 也可以透過 API 確認牌組存在
    const getDeckResponse = await request.get(`http://localhost:3280/decks/${deckId}`);
    expect(getDeckResponse.ok()).toBe(true);

    // 清理：刪除測試牌組
    await request.delete(`http://localhost:3280/decks/${deckId}`);
  });
});
