// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('Email 登入功能', () => {
  test('從登入頁面切換至註冊頁面', async ({ page }) => {
    // 1. 前往登入頁面 /login
    await page.goto('/login');

    // 2. 點擊頁面標題右側的「註冊新帳號」連結
    await page.getByRole('link', { name: '註冊新帳號' }).click();

    // 3. 驗證導向至 /register 頁面
    await expect(page).toHaveURL('/register');
    
    // 驗證頁面顯示「註冊帳號」標題
    await expect(page.getByText('註冊帳號')).toBeVisible();
  });
});
