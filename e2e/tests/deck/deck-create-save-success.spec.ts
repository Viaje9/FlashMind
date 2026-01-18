// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('建立新牌組', () => {
  test('測試填寫並儲存牌組（成功流程）', async ({ page, request }) => {
    // 1. 使用 API 建立測試帳號並登入
    const testEmail = `test-${Date.now()}@test.com`;
    const testPassword = 'Test1234!';

    // 用 request 註冊帳號
    const registerResponse = await request.post('http://localhost:3280/auth/register', {
      data: { email: testEmail, password: testPassword }
    });
    expect(registerResponse.ok()).toBeTruthy();

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

    // 3. 在牌組名稱輸入框輸入「我的測試牌組」
    const deckNameInput = page.getByRole('textbox', { name: '牌組名稱' });
    await deckNameInput.fill('我的測試牌組');

    // 4. 保持預設的每日新卡數（20）和每日複習數（100）
    await expect(page.getByRole('spinbutton', { name: '每日新卡數' })).toHaveValue('20');
    await expect(page.getByRole('spinbutton', { name: '每日複習數' })).toHaveValue('100');

    // 5. 點擊「儲存設定」按鈕
    const saveButton = page.getByRole('button', { name: '儲存設定' });

    // 6. 等待 API 請求完成
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/decks') && response.request().method() === 'POST'
    );

    await saveButton.click();

    const response = await responsePromise;
    expect(response.status()).toBe(201);

    const responseData = await response.json();
    const newDeckId = responseData.data.id;

    // 7. 驗證導航至牌組詳情頁 /decks/:id
    await expect(page).toHaveURL(`/decks/${newDeckId}`, { timeout: 10000 });

    // 8. 驗證詳情頁顯示正確的牌組名稱「我的測試牌組」
    await expect(page.getByRole('heading', { name: '我的測試牌組', level: 1 })).toBeVisible();
  });
});
