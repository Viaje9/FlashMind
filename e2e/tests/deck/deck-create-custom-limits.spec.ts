// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('建立新牌組', () => {
  test('測試設定每日學習數', async ({ page, request }) => {
    // 1. 使用 API 建立測試帳號並登入
    const testEmail = `test-custom-limits-${Date.now()}@test.com`;
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

    // 透過 UI 登入讓 page 獲得 session cookie
    await page.goto('/login');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('密碼').fill(testPassword);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL('/decks', { timeout: 10000 });

    // 2. 導航至 /decks/new
    await page.goto('/decks/new');

    // 等待頁面加載完成
    await expect(page.getByRole('heading', { name: '新增牌組', level: 1 })).toBeVisible();

    // 3. 在牌組名稱輸入框輸入「自訂設定牌組」
    const deckNameInput = page.getByRole('textbox', { name: '牌組名稱' });
    await deckNameInput.fill('自訂設定牌組');

    // 4. 點擊每日新卡數輸入框，清空後輸入「30」
    const dailyNewCardsInput = page.getByRole('spinbutton', { name: '每日新卡數' });
    await dailyNewCardsInput.click();
    await dailyNewCardsInput.fill('30');

    // 5. 點擊每日複習數輸入框，清空後輸入「150」
    const dailyReviewCardsInput = page.getByRole('spinbutton', { name: '每日複習數' });
    await dailyReviewCardsInput.click();
    await dailyReviewCardsInput.fill('150');

    // 6. 點擊「儲存設定」按鈕
    const saveButton = page.getByRole('button', { name: '儲存設定' });

    // 7. 等待導航至詳情頁
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/decks') && response.request().method() === 'POST'
    );

    await saveButton.click();

    const response = await responsePromise;
    expect(response.status()).toBe(201);

    const responseData = await response.json();
    const newDeckId = responseData.data.id;

    // 驗證導航至牌組詳情頁
    await expect(page).toHaveURL(`/decks/${newDeckId}`, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: '自訂設定牌組', level: 1 })).toBeVisible();

    // 8. 導航至牌組設定頁面 /decks/:id/settings
    await page.goto(`/decks/${newDeckId}/settings`);

    // 等待設定頁面加載
    await expect(page.getByRole('heading', { name: '牌組設定', level: 1 })).toBeVisible();

    // 9. 驗證每日新卡數顯示為「30」
    await expect(page.getByRole('spinbutton', { name: '每日新卡數' })).toHaveValue('30');

    // 10. 驗證每日複習數顯示為「150」
    await expect(page.getByRole('spinbutton', { name: '每日複習數' })).toHaveValue('150');
  });
});
