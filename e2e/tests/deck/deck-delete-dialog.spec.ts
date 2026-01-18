// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('刪除牌組', () => {
  test('測試刪除確認對話框', async ({ page, request }) => {
    // 1. 使用 API 建立測試帳號並登入
    const testEmail = `test-delete-dialog-${Date.now()}@test.com`;
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

    // 2. 透過 API 建立測試牌組「待刪除牌組」
    const deckResponse = await request.post('http://localhost:3280/decks', {
      data: { name: '待刪除牌組', dailyNewCards: 20, dailyReviewCards: 100 }
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

    // 3. 導航至牌組設定頁 /decks/:id/settings
    await page.goto(`/decks/${deckId}/settings`);

    // 驗證成功導航至設定頁面
    await expect(page).toHaveURL(`/decks/${deckId}/settings`);
    await expect(page.getByRole('heading', { name: '牌組設定', level: 1 })).toBeVisible();

    // 4. 向下捲動至「危險區域」區塊
    const dangerZoneHeading = page.getByRole('heading', { name: '危險區域' });
    await dangerZoneHeading.scrollIntoViewIfNeeded();

    // 驗證頁面捲動至危險區域
    await expect(dangerZoneHeading).toBeVisible();

    // 5. 點擊「刪除牌組」按鈕
    const deleteButton = page.getByRole('button', { name: '刪除牌組' });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    // 6. 驗證確認對話框出現
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // 7. 驗證對話框標題為「刪除牌組」
    await expect(dialog.getByRole('heading', { name: '刪除牌組' })).toBeVisible();

    // 8. 驗證對話框內容提到牌組名稱「待刪除牌組」
    await expect(dialog.getByText('待刪除牌組')).toBeVisible();

    // 9. 驗證對話框顯示警告訊息「此操作將刪除所有卡片與學習紀錄，且無法復原」
    await expect(dialog.getByText(/此操作將刪除所有卡片與學習紀錄，且無法復原/)).toBeVisible();

    // 10. 驗證對話框有「取消」按鈕
    const cancelButton = dialog.getByRole('button', { name: '取消' });
    await expect(cancelButton).toBeVisible();

    // 11. 驗證對話框有「確認」按鈕
    const confirmButton = dialog.getByRole('button', { name: /確認/ });
    await expect(confirmButton).toBeVisible();

    // 清理：關閉對話框並刪除測試牌組
    await cancelButton.click();
    await expect(dialog).not.toBeVisible();

    await request.delete(`http://localhost:3280/decks/${deckId}`);
  });
});
