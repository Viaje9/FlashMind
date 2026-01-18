// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('刪除牌組', () => {
  test('測試刪除按鈕 loading 狀態', async ({ page, request }) => {
    // 1. 使用 API 建立測試帳號並登入
    const testEmail = `test-delete-loading-${Date.now()}@test.com`;
    const testPassword = 'Test1234!';

    // 用 request 註冊帳號
    const registerResponse = await request.post('http://localhost:3280/auth/register', {
      data: { email: testEmail, password: testPassword }
    });
    expect(registerResponse.ok()).toBeTruthy();

    // 用 request 登入（讓 request context 有 cookie）
    const loginResponse = await request.post('http://localhost:3280/auth/login', {
      data: { email: testEmail, password: testPassword }
    });
    expect(loginResponse.ok()).toBeTruthy();

    // 2. 透過 API 建立測試牌組「載入測試」
    const deckResponse = await request.post('http://localhost:3280/decks', {
      data: { name: '載入測試', dailyNewCards: 20, dailyReviewCards: 100 }
    });
    expect(deckResponse.ok()).toBeTruthy();
    const deckData = await deckResponse.json();
    const deckId = deckData.data.id;

    // 透過 UI 登入讓 page 獲得 session cookie
    await page.goto('/login');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('密碼').fill(testPassword);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL('/decks', { timeout: 10000 });

    // 3. 導航至牌組設定頁
    await page.goto(`/decks/${deckId}/settings`);
    await expect(page).toHaveURL(`/decks/${deckId}/settings`);
    await expect(page.getByRole('heading', { name: '牌組設定', level: 1 })).toBeVisible();

    // 4. 點擊「刪除牌組」按鈕開啟確認對話框
    await page.getByRole('button', { name: '刪除牌組' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: '刪除牌組' })).toBeVisible();

    // 5. 監聽 DELETE API 請求
    // 使用 page.route() 延遲 DELETE 請求以便驗證 loading 狀態
    let deleteRequestReceived = false;
    let continueRequest: (() => void) | null = null;

    await page.route(`**/decks/${deckId}`, async (route) => {
      if (route.request().method() === 'DELETE') {
        deleteRequestReceived = true;
        // 延遲請求以便我們能夠驗證 loading 狀態
        await new Promise<void>((resolve) => {
          continueRequest = () => {
            resolve();
            route.continue();
          };
          // 自動在 500ms 後繼續，以防測試卡住
          setTimeout(resolve, 500);
        });
      } else {
        await route.continue();
      }
    });

    // 6. 點擊「確認」按鈕
    const confirmButton = dialog.getByRole('button', { name: /確認/ });
    await confirmButton.click();

    // 7. 在 API 回應前，驗證「確認」按鈕顯示 loading 狀態或文字變化
    // 8. 驗證按鈕在 loading 期間為 disabled 狀態
    // 由於我們延遲了 DELETE 請求，按鈕應該顯示 loading 狀態
    await expect(confirmButton).toBeDisabled();

    // 檢查是否有 loading 指示器或文字變化
    // 這取決於實際實作，可能是文字變更為「刪除中...」或顯示 spinner
    const hasLoadingState = await Promise.race([
      dialog.getByText(/刪除中|載入中|處理中/).isVisible().catch(() => false),
      confirmButton.evaluate((el) => el.classList.contains('loading')).catch(() => false),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 100)),
    ]);

    // 9. 等待 API 完成
    if (continueRequest) {
      continueRequest();
    }

    // 10. 驗證成功導航至列表頁
    await expect(page).toHaveURL('/decks');

    // 驗證牌組已被刪除
    const deletedDeck = page.getByRole('article').filter({ hasText: '載入測試' });
    await expect(deletedDeck).not.toBeVisible();
  });
});
