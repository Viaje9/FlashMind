// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('Google OAuth 登入功能', () => {
  test('Google OAuth 授權失敗（使用者取消授權）', async ({ page }) => {
    // 1. 模擬使用者在 Google 授權頁面點擊「取消」
    // 2. 瀏覽器導向至 /auth/google/callback?error=access_denied
    await page.goto('/auth/google/callback?error=access_denied');

    // 3. 後端處理錯誤並重新導向至歡迎頁面（帶錯誤參數）
    await expect(page).toHaveURL(/\/welcome\?error=access_denied/, { timeout: 10000 });

    // 驗證前端頁面顯示錯誤訊息
    await expect(page.getByText(/授權失敗|登入失敗|access_denied/i)).toBeVisible();
  });
});
