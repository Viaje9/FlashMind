// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('Email 登入功能', () => {
  test('登入時 Email 格式驗證', async ({ page }) => {
    // 1. 前往登入頁面 /login
    await page.goto('/login');

    // 2. 在 Email 欄位輸入 invalid-email（無效格式）
    await page.getByLabel('Email').fill('invalid-email');

    // 3. 在密碼欄位點擊觸發 blur 事件
    await page.getByLabel('密碼').click();

    // 驗證 Email 欄位下方顯示錯誤訊息「請輸入有效的 Email 格式」
    await expect(page.getByText('請輸入有效的 Email 格式')).toBeVisible();
  });

  test('登入時必填欄位驗證', async ({ page }) => {
    // 1. 前往登入頁面 /login
    await page.goto('/login');

    // 2. Email 欄位留空
    // 3. 在密碼欄位輸入 password123456
    await page.getByLabel('密碼').fill('password123456');

    // 4. 點擊「登入」按鈕
    await page.getByTestId('login-submit').click();

    // 驗證 Email 欄位顯示錯誤訊息「請輸入 Email」
    await expect(page.getByText('請輸入 Email')).toBeVisible();
    
    // 驗證使用者停留在 /login 頁面
    await expect(page).toHaveURL('/login');
  });
});
