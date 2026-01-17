// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('Email 註冊功能', () => {
  test('成功使用 Email 註冊新帳號', async ({ page }) => {
    // 1. 前往歡迎頁面 /welcome
    await page.goto('/welcome');

    // 2. 點擊「開始使用」按鈕
    await page.getByRole('button', { name: '開始使用' }).click();

    // 3. 驗證頁面導向至 /register
    await expect(page).toHaveURL('/register');

    // 4. 在 Email 欄位輸入唯一的測試 Email
    const timestamp = Date.now();
    const testEmail = `test-${timestamp}@example.com`;
    await page.getByTestId('register-email').fill(testEmail);

    // 5. 在密碼欄位輸入 password123456
    await page.getByTestId('register-password').fill('password123456');

    // 6. 在確認密碼欄位輸入 password123456
    await page.getByTestId('register-confirm-password').fill('password123456');

    // 7. 點擊「註冊」按鈕
    await page.getByTestId('register-submit').click();

    // 8. 等待註冊請求完成並驗證結果
    await expect(page).toHaveURL('/decks', { timeout: 10000 });
  });
});
