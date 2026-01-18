// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('編輯牌組設定', () => {
  test('測試只修改部分欄位', async ({ page, request }) => {
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

    // 2. 透過 API 建立測試牌組「部分更新測試」
    const deckResponse = await request.post('http://localhost:3280/decks', {
      data: { name: '部分更新測試', dailyNewCards: 20, dailyReviewCards: 100 }
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

    // 4. 只修改牌組名稱為「只改名稱」，保持其他欄位不變
    const nameInput = page.getByRole('textbox', { name: '牌組名稱' });
    await nameInput.clear();
    await nameInput.fill('只改名稱');

    // 5. 點擊「儲存設定」按鈕
    await page.getByRole('button', { name: '儲存設定' }).click();

    // 6. 驗證更新成功並返回詳情頁
    await expect(page).toHaveURL(`/decks/${deckId}`);

    // 驗證詳情頁標題顯示「只改名稱」
    await expect(page.getByRole('heading', { name: '只改名稱', level: 1 })).toBeVisible();

    // 7. 返回設定頁驗證
    await page.getByRole('button', { name: '設定' }).click();
    await expect(page).toHaveURL(`/decks/${deckId}/settings`);

    // 8. 驗證牌組名稱為「只改名稱」
    await expect(page.getByRole('textbox', { name: '牌組名稱' })).toHaveValue('只改名稱');

    // 9. 驗證每日新卡數仍為「20」
    await expect(page.getByRole('spinbutton', { name: '每日新卡數' })).toHaveValue('20');

    // 10. 驗證每日複習數仍為「100」
    await expect(page.getByRole('spinbutton', { name: '每日複習數' })).toHaveValue('100');
  });
});
