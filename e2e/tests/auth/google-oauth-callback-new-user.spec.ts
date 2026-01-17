// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('Google OAuth 登入功能', () => {
  test.skip('Google OAuth Callback 成功（新使用者）', async ({ page }) => {
    // 註：此測試需要 mock Google OAuth 服務
    // 在實際測試環境中，需要設置測試用的 OAuth provider 或使用 mock server
    
    // 1. 模擬 Google OAuth 授權完成
    // 2. 瀏覽器導向至 /auth/google/callback?code=MOCK_AUTH_CODE&state=MOCK_STATE
    await page.goto('/auth/google/callback?code=MOCK_AUTH_CODE&state=MOCK_STATE');

    // 3-5. 後端驗證授權碼、建立使用者、建立 OAuthAccount、建立 session

    // 驗證最終導向至 /decks 頁面
    await expect(page).toHaveURL('/decks', { timeout: 10000 });
  });
});
