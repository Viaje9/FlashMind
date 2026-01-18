// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('權限與安全性測試', () => {
  test('測試 API 錯誤處理（網路錯誤）', async ({ page, request }) => {
    // 1. 使用 API 建立測試帳號並登入
    const testEmail = `test-network-error-${Date.now()}@test.com`;
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

    // 3. 使用 Playwright 攔截 POST /decks 請求
    // 4. 模擬網路錯誤（回應 500 Internal Server Error）
    await page.route('**/decks', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'INTERNAL_SERVER_ERROR',
              message: '伺服器內部錯誤'
            }
          })
        });
      } else {
        await route.continue();
      }
    });

    // 5. 填寫表單並點擊「儲存設定」
    const deckNameInput = page.getByRole('textbox', { name: '牌組名稱' });
    await deckNameInput.fill('測試網路錯誤');

    // 驗證預設值
    await expect(page.getByRole('spinbutton', { name: '每日新卡數' })).toHaveValue('20');
    await expect(page.getByRole('spinbutton', { name: '每日複習數' })).toHaveValue('100');

    const saveButton = page.getByRole('button', { name: '儲存設定' });
    await saveButton.click();

    // 6. 驗證顯示錯誤訊息「建立牌組失敗，請稍後再試」或類似訊息
    // 等待錯誤訊息出現（根據實際應用的錯誤訊息實現方式調整）
    await expect(
      page.getByText(/建立牌組失敗|建立失敗|請稍後再試|錯誤|失敗/)
    ).toBeVisible({ timeout: 5000 });

    // 7. 驗證仍停留在建立頁面
    await expect(page).toHaveURL(/\/decks\/new$/);

    // 8. 驗證表單資料未遺失
    await expect(deckNameInput).toHaveValue('測試網路錯誤');
    await expect(page.getByRole('spinbutton', { name: '每日新卡數' })).toHaveValue('20');
    await expect(page.getByRole('spinbutton', { name: '每日複習數' })).toHaveValue('100');
  });
});
