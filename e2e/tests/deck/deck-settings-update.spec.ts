// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('編輯牌組設定', () => {
  test('測試修改並儲存設定', async ({ page, request }) => {
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

    // 2. 透過 API 建立測試牌組「原始名稱」
    const deckResponse = await request.post('http://localhost:3280/decks', {
      data: { name: '原始名稱', dailyNewCards: 20, dailyReviewCards: 100 }
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

    // 3. 透過牌組列表導航至牌組設定頁
    await page.getByText('原始名稱').click();
    await page.getByRole('button', { name: '設定' }).click();

    // 驗證在設定頁面
    await expect(page).toHaveURL(`/decks/${deckId}/settings`);
    await expect(page.getByRole('heading', { name: '牌組設定', level: 1 })).toBeVisible();

    // 4. 將牌組名稱修改為「更新後的名稱」
    const nameInput = page.getByRole('textbox', { name: '牌組名稱' });
    await nameInput.clear();
    await nameInput.fill('更新後的名稱');

    // 5. 將每日新卡數修改為「35」
    const newCardsInput = page.getByRole('spinbutton', { name: '每日新卡數' });
    await newCardsInput.clear();
    await newCardsInput.fill('35');

    // 6. 將每日複習數修改為「200」
    const reviewCardsInput = page.getByRole('spinbutton', { name: '每日複習數' });
    await reviewCardsInput.clear();
    await reviewCardsInput.fill('200');

    // 7. 點擊「儲存設定」按鈕
    await page.getByRole('button', { name: '儲存設定' }).click();

    // 8-9. 驗證導航回牌組詳情頁
    await expect(page).toHaveURL(`/decks/${deckId}`);

    // 10. 驗證詳情頁標題顯示「更新後的名稱」
    await expect(page.getByRole('heading', { name: '更新後的名稱', level: 1 })).toBeVisible();

    // 11. 返回設定頁驗證修改已保存
    await page.getByRole('button', { name: '設定' }).click();
    await expect(page).toHaveURL(`/decks/${deckId}/settings`);

    // 12-14. 驗證設定值已保存
    await expect(page.getByRole('textbox', { name: '牌組名稱' })).toHaveValue('更新後的名稱');
    await expect(page.getByRole('spinbutton', { name: '每日新卡數' })).toHaveValue('35');
    await expect(page.getByRole('spinbutton', { name: '每日複習數' })).toHaveValue('200');
  });
});
