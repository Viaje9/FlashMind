// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('UI/UX 與使用者體驗', () => {
  test('註冊表單 Enter 鍵提交', async ({ page }) => {
    // 1. 前往註冊頁面 /register
    await page.goto('/register');

    // 2. 填寫完整註冊資訊
    const timestamp = Date.now();
    const testEmail = `test-keyboard-${timestamp}@example.com`;
    
    await page.getByTestId('register-email').fill(testEmail);

    await page.getByTestId('register-password').fill('password123456');

    await page.getByTestId('register-confirm-password').fill('password123456');

    // 3. 在確認密碼欄位中按下 Enter 鍵
    await page.getByTestId('register-confirm-password').press('Enter');

    // 驗證表單自動提交
    // 驗證觸發註冊 API 請求
    // 驗證成功註冊並導向 /decks
    await expect(page).toHaveURL('/decks', { timeout: 10000 });
  });
});
