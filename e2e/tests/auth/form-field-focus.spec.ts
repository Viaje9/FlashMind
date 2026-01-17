// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('UI/UX 與使用者體驗', () => {
  test('表單欄位 Focus 順序', async ({ page }) => {
    // 1. 前往登入頁面 /login
    await page.goto('/login');

    // 2. 按下 Tab 鍵導航表單欄位
    // 3. 依序觀察 focus 順序

    // 先點擊 Email 欄位開始
    await page.getByTestId('login-email').click();
    await expect(page.getByTestId('login-email')).toBeFocused();

    // Tab 到密碼欄位
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('login-password')).toBeFocused();

    // Tab 到「記住我」勾選框
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('login-remember-me')).toBeFocused();

    // Tab 到登入按鈕
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('login-submit')).toBeFocused();

    // 驗證所有互動元素均可透過鍵盤存取
    // 驗證符合無障礙標準（Accessibility）
  });
});
