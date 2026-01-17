// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('Session 與權限管理', () => {
  test('未登入時存取受保護頁面自動導向登入', async ({ page, context }) => {
    // 1. 前置條件：使用者未登入
    // 2. 清除所有 cookies
    await context.clearCookies();

    // 3. 手動導向至 /decks 頁面
    await page.goto('/decks');

    // 4-5. 前端 AuthGuard 檢查認證狀態並呼叫 /auth/me API
    // 驗證 API 回傳 401 Unauthorized
    // 驗證前端自動導向至 /login 頁面
    await expect(page).toHaveURL('/login', { timeout: 10000 });

    // 驗證顯示登入表單
    await expect(page.getByText('登入帳號')).toBeVisible();
  });
});
