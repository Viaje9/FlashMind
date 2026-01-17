// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('Email 註冊功能', () => {
  test('從註冊頁面切換至登入頁面', async ({ page }) => {
    // 1. 前往註冊頁面 /register
    await page.goto('/register');

    // 2. 點擊頁面標題右側的「登入現有帳號」連結
    await page.getByRole('link', { name: '登入現有帳號' }).click();

    // 3. 驗證導向至 /login 頁面
    await expect(page).toHaveURL('/login');
    
    // 驗證頁面顯示「登入帳號」標題
    await expect(page.getByText('登入帳號')).toBeVisible();
  });
});
