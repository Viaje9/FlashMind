// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('編輯牌組設定', () => {
  test('測試進入設定頁面', async ({ page, request }) => {
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

    // 2. 透過 API 建立測試牌組「設定測試牌組」
    const deckResponse = await request.post('http://localhost:3280/decks', {
      data: { name: '設定測試牌組', dailyNewCards: 20, dailyReviewCards: 100 }
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

    // 3-4. 點擊「設定測試牌組」進入詳情頁
    await page.getByText('設定測試牌組').click();

    // 5. 點擊右上角「設定」按鈕
    await page.getByRole('button', { name: '設定' }).click();

    // 6. 驗證導航至 /decks/:id/settings
    await expect(page).toHaveURL(`/decks/${deckId}/settings`);

    // 7. 驗證頁面標題顯示「牌組設定」
    await expect(page.getByRole('heading', { name: '牌組設定' })).toBeVisible();

    // 8. 驗證返回按鈕顯示
    await expect(page.getByRole('button', { name: '返回' })).toBeVisible();

    // 9. 驗證牌組名稱輸入框顯示並已填入「設定測試牌組」
    const nameInput = page.getByRole('textbox', { name: '牌組名稱' });
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveValue('設定測試牌組');

    // 10. 驗證每日新卡數輸入框顯示「20」
    const dailyNewCardsInput = page.getByRole('spinbutton', { name: '每日新卡數' });
    await expect(dailyNewCardsInput).toBeVisible();
    await expect(dailyNewCardsInput).toHaveValue('20');

    // 11. 驗證每日複習數輸入框顯示「100」
    const dailyReviewCardsInput = page.getByRole('spinbutton', { name: '每日複習數' });
    await expect(dailyReviewCardsInput).toBeVisible();
    await expect(dailyReviewCardsInput).toHaveValue('100');

    // 12. 驗證「學習計畫設定」區塊顯示
    await expect(page.getByRole('heading', { name: '學習計畫設定' })).toBeVisible();

    // 13. 驗證「危險區域」區塊顯示
    await expect(page.getByRole('heading', { name: '危險區域' })).toBeVisible();

    // 14. 驗證「刪除牌組」按鈕顯示
    await expect(page.getByRole('button', { name: '刪除牌組' })).toBeVisible();

    // 15. 驗證「儲存設定」按鈕顯示
    await expect(page.getByRole('button', { name: '儲存設定' })).toBeVisible();

    // 16. 驗證「取消」按鈕顯示
    await expect(page.getByRole('button', { name: '取消' })).toBeVisible();
  });
});
