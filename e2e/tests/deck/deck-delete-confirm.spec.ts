// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('刪除牌組', () => {
  test('測試確認刪除', async ({ page, request }) => {
    // 1. 使用 API 建立測試帳號並登入
    const testEmail = `test-delete-confirm-${Date.now()}@test.com`;
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

    // 2. 透過 API 建立測試牌組「即將被刪除」
    // 3. 記錄牌組 ID
    const deckResponse = await request.post('http://localhost:3280/decks', {
      data: { name: '即將被刪除', dailyNewCards: 20, dailyReviewCards: 100 }
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

    // 4. 導航至牌組設定頁
    await page.goto(`/decks/${deckId}/settings`);

    // 驗證成功導航至設定頁面
    await expect(page).toHaveURL(`/decks/${deckId}/settings`);
    await expect(page.getByRole('heading', { name: '牌組設定', level: 1 })).toBeVisible();

    // 5. 點擊「刪除牌組」按鈕開啟確認對話框
    await page.getByRole('button', { name: '刪除牌組' }).click();

    // 驗證確認對話框顯示
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: '刪除牌組' })).toBeVisible();
    await expect(dialog.getByText('即將被刪除')).toBeVisible();
    await expect(dialog.getByText(/此操作將刪除所有卡片與學習紀錄，且無法復原/)).toBeVisible();

    // 6. 點擊對話框中的「確認」按鈕
    await dialog.getByRole('button', { name: /確認/ }).click();

    // 7. 等待 API 請求完成
    // 8. 驗證導航回牌組列表頁 /decks
    await expect(page).toHaveURL('/decks');

    // 9. 驗證列表中不再顯示「即將被刪除」牌組
    const deletedDeck = page.getByRole('article').filter({ hasText: '即將被刪除' });
    await expect(deletedDeck).not.toBeVisible();

    // 也可以驗證顯示空狀態（如果這是唯一的牌組）
    const emptyState = page.getByText('尚無牌組');
    // 空狀態可能顯示也可能不顯示，取決於是否有其他牌組

    // 10. 嘗試直接訪問已刪除牌組的 URL /decks/:id
    await page.goto(`/decks/${deckId}`);

    // 11. 驗證顯示 404 或適當的錯誤訊息
    // 可能會重定向到列表頁或顯示錯誤訊息
    // 根據實際實作情況調整驗證邏輯
    const currentUrl = page.url();
    const is404OrRedirected = currentUrl.includes('/decks') && !currentUrl.includes(`/decks/${deckId}`);

    // 如果沒有重定向，應該顯示錯誤訊息
    if (!is404OrRedirected) {
      // 驗證顯示適當的錯誤訊息
      await expect(page.getByText(/找不到|不存在|錯誤/)).toBeVisible();
    }
  });
});
