// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('Google OAuth 登入功能', () => {
  test.skip('Google OAuth Callback 成功（既有使用者）', async ({ page }) => {
    // 註：此測試需要 mock Google OAuth 服務
    // 在實際測試環境中，需要先建立使用 Google 登入的測試使用者
    
    // 1. 前置條件：資料庫已存在使用相同 Google 帳號的使用者
    // 2. 模擬 Google OAuth 授權完成
    // 3. 瀏覽器導向至 /auth/google/callback?code=MOCK_AUTH_CODE&state=MOCK_STATE
    await page.goto('/auth/google/callback?code=MOCK_AUTH_CODE&state=MOCK_STATE');

    // 4-5. 後端驗證授權碼、查詢既有 OAuthAccount、更新 lastLoginAt

    // 驗證最終導向至 /decks 頁面
    await expect(page).toHaveURL('/decks', { timeout: 10000 });
  });
});
