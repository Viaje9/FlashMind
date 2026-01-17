// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('UI/UX 與使用者體驗', () => {
  test('註冊載入狀態 UI 回饋', async ({ page }) => {
    // 1. 前往註冊頁面 /register
    await page.goto('/register');

    // 2. 填寫完整註冊資訊
    const timestamp = Date.now();
    const testEmail = `test-loading-${timestamp}@example.com`;
    
    await page.getByTestId('register-email').fill(testEmail);

    await page.getByTestId('register-password').fill('password123456');

    await page.getByTestId('register-confirm-password').fill('password123456');

    // 3. 點擊「註冊」按鈕
    await page.getByTestId('register-submit').click();

    // 4. 在 API 回應前觀察按鈕狀態
    // 驗證按鈕文字變更為「註冊中...」
    await expect(page.getByRole('button', { name: '註冊中...' })).toBeVisible();

    // 驗證註冊成功後導向頁面
    await expect(page).toHaveURL('/decks', { timeout: 10000 });
  });
});
