// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('檢視牌組列表', () => {
  test('測試空狀態顯示', async ({ page, request }) => {
    // 1. 使用 API 建立全新測試帳號並登入（不建立任何牌組）
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

    // 2. 驗證導航至 /decks 頁面
    await expect(page).toHaveURL('/decks', { timeout: 10000 });

    // 3. 驗證空狀態圖示顯示（library_add icon）
    await expect(page.getByText('library_add')).toBeVisible();

    // 4. 驗證空狀態標題「尚無牌組」顯示
    await expect(page.getByText('尚無牌組')).toBeVisible();

    // 5. 驗證空狀態提示「點擊右下角 + 按鈕建立第一個牌組」顯示
    await expect(page.getByText('點擊右下角 + 按鈕建立第一個牌組')).toBeVisible();

    // 6. 驗證新增牌組按鈕顯示
    await expect(page.getByRole('button', { name: '新增牌組' })).toBeVisible();
  });
});
