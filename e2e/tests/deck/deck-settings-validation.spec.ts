// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('編輯牌組設定', () => {
  test('測試設定頁驗證錯誤', async ({ page, request }) => {
    // 1. 使用 API 建立測試帳號並登入
    const testEmail = `test-settings-validation-${Date.now()}@test.com`;
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

    // 2. 透過 API 建立測試牌組「驗證測試」
    const deckResponse = await request.post('http://localhost:3280/decks', {
      data: { name: '驗證測試', dailyNewCards: 20, dailyReviewCards: 100 }
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

    // 驗證在設定頁面
    await expect(page).toHaveURL(`/decks/${deckId}/settings`);
    await expect(page.getByRole('heading', { name: '牌組設定', level: 1 })).toBeVisible();

    // 驗證表單已載入正確的初始值
    const nameInput = page.getByRole('textbox', { name: '牌組名稱' });
    await expect(nameInput).toHaveValue('驗證測試');

    // 4. 清空牌組名稱欄位
    await nameInput.clear();
    await expect(nameInput).toHaveValue('');

    // 5. 點擊「儲存設定」按鈕
    const saveButton = page.getByRole('button', { name: '儲存設定' });
    await saveButton.click();

    // 6. 驗證顯示錯誤訊息（名稱必填）
    await expect(page.getByText('請輸入牌組名稱')).toBeVisible();

    // 7. 驗證仍停留在設定頁面
    await expect(page).toHaveURL(`/decks/${deckId}/settings`);

    // 8. 輸入有效的牌組名稱「修正後的名稱」
    await nameInput.fill('修正後的名稱');
    await expect(nameInput).toHaveValue('修正後的名稱');

    // 9. 再次點擊「儲存設定」
    const responsePromise = page.waitForResponse(
      response => response.url().includes(`/decks/${deckId}`) && response.request().method() === 'PATCH'
    );

    await saveButton.click();

    // 等待 API 回應
    const patchResponse = await responsePromise;
    expect(patchResponse.ok()).toBeTruthy();

    // 10. 驗證錯誤訊息消失
    await expect(page.getByText('請輸入牌組名稱')).not.toBeVisible();

    // 11. 驗證成功保存並導航至詳情頁
    await expect(page).toHaveURL(`/decks/${deckId}`);

    // 驗證詳情頁顯示更新後的名稱
    await expect(page.getByRole('heading', { name: '修正後的名稱', level: 1 })).toBeVisible();
  });
});
