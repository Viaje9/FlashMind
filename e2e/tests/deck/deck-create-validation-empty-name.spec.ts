// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('建立新牌組', () => {
  test('測試驗證錯誤（空牌組名稱）', async ({ page, request }) => {
    // 1. 使用 API 建立測試帳號並登入
    const testEmail = `test-empty-name-${Date.now()}@test.com`;
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

    // 3. 不輸入牌組名稱，保持空白
    const deckNameInput = page.getByRole('textbox', { name: '牌組名稱' });
    await expect(deckNameInput).toHaveValue('');

    // 4. 點擊「儲存設定」按鈕
    const saveButton = page.getByRole('button', { name: '儲存設定' });
    await saveButton.click();

    // 5. 驗證顯示錯誤訊息「請輸入牌組名稱」
    await expect(page.getByText('請輸入牌組名稱')).toBeVisible();

    // 6. 驗證仍停留在 /decks/new 頁面
    await expect(page).toHaveURL('/decks/new');

    // 7. 在牌組名稱輸入框輸入「有效的牌組名稱」
    await deckNameInput.fill('有效的牌組名稱');

    // 8. 再次點擊「儲存設定」按鈕
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/decks') && response.request().method() === 'POST'
    );

    await saveButton.click();

    const response = await responsePromise;
    expect(response.status()).toBe(201);

    const responseData = await response.json();
    const newDeckId = responseData.data.id;

    // 9. 驗證錯誤訊息消失
    await expect(page.getByText('請輸入牌組名稱')).not.toBeVisible();

    // 10. 驗證成功導航至詳情頁
    await expect(page).toHaveURL(`/decks/${newDeckId}`, { timeout: 10000 });
  });
});
