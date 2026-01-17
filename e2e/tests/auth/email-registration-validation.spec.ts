// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('Email 註冊功能', () => {
  test('註冊時密碼長度驗證（少於 8 字元）', async ({ page }) => {
    // 1. 前往註冊頁面 /register
    await page.goto('/register');

    // 2. 在 Email 欄位輸入 test@example.com
    await page.getByTestId('register-email').fill('test@example.com');

    // 3. 在密碼欄位輸入 pass123（7 字元）
    await page.getByTestId('register-password').fill('pass123');

    // 4. 在確認密碼欄位輸入 pass123
    await page.getByTestId('register-confirm-password').fill('pass123');

    // 5. 點擊密碼欄位外部觸發 blur 驗證
    await page.getByTestId('register-email').click();

    // 驗證密碼欄位下方顯示錯誤訊息「密碼至少需要 8 個字元」
    await expect(page.getByText('密碼至少需要 8 個字元')).toBeVisible();

    // 驗證仍停留在 /register 頁面
    await expect(page).toHaveURL('/register');
  });

  test('註冊時密碼與確認密碼不一致', async ({ page }) => {
    // 1. 前往註冊頁面 /register
    await page.goto('/register');

    // 2. 在 Email 欄位輸入 test@example.com
    await page.getByTestId('register-email').fill('test@example.com');

    // 3. 在密碼欄位輸入 password123456
    await page.getByTestId('register-password').fill('password123456');

    // 4. 在確認密碼欄位輸入 password654321（不一致）
    await page.getByTestId('register-confirm-password').fill('password654321');

    // 5. 點擊確認密碼欄位外部觸發驗證
    await page.getByTestId('register-email').click();

    // 驗證確認密碼欄位下方顯示錯誤訊息「密碼與確認密碼不一致」
    await expect(page.getByText('密碼與確認密碼不一致')).toBeVisible();

    // 驗證仍停留在 /register 頁面
    await expect(page).toHaveURL('/register');
  });

  test('註冊時 Email 格式驗證', async ({ page }) => {
    // 1. 前往註冊頁面 /register
    await page.goto('/register');

    // 2. 在 Email 欄位輸入 invalid-email（無效格式）
    await page.getByTestId('register-email').fill('invalid-email');

    // 3. 在密碼欄位點擊觸發 blur 事件
    await page.getByTestId('register-password').click();

    // 驗證 Email 欄位下方顯示錯誤訊息「請輸入有效的 Email 格式」
    await expect(page.getByText('請輸入有效的 Email 格式')).toBeVisible();
  });
});
