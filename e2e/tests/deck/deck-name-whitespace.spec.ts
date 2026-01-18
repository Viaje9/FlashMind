// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('整合與邊界情況測試', () => {
  test('測試空白和空格牌組名稱', async ({ page, request }) => {
    // 1. 使用 API 建立測試帳號並登入
    const testEmail = `test-whitespace-${Date.now()}@test.com`;
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

    // 3. 在牌組名稱輸入框只輸入空格「   」
    await page.getByRole('textbox', { name: '牌組名稱' }).fill('   ');

    // 4. 點擊「儲存設定」
    await page.getByRole('button', { name: '儲存設定' }).click();

    // 5. 驗證顯示驗證錯誤（視為空名稱）
    await expect(page.getByText('請輸入牌組名稱')).toBeVisible();

    // 6. 輸入前後有空格的名稱「  測試牌組  」
    await page.getByRole('textbox', { name: '牌組名稱' }).fill('  測試牌組  ');

    // 7. 點擊「儲存設定」
    await page.getByRole('button', { name: '儲存設定' }).click();

    // 8. 驗證牌組建立成功
    await expect(page).toHaveURL(/\/decks\/[^/]+$/);

    // 9. 驗證牌組名稱被 trim 處理（前後空格移除）或保留原樣
    await expect(page.getByRole('heading', { level: 1 })).toContainText('測試牌組');

    // 10. 導航至列表頁驗證顯示
    await page.goto('/decks');
    await expect(page.getByText('測試牌組')).toBeVisible();
  });
});
