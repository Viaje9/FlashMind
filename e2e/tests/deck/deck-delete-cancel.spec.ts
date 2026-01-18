// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('刪除牌組', () => {
  test('測試取消刪除', async ({ page, request }) => {
    // 1. 使用 API 建立測試帳號並登入
    const testEmail = `test-cancel-delete-${Date.now()}@test.com`;
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

    // 2. 透過 API 建立測試牌組「不會被刪除」
    const deckResponse = await request.post('http://localhost:3280/decks', {
      data: { name: '不會被刪除', dailyNewCards: 20, dailyReviewCards: 100 }
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

    // 驗證成功導航至設定頁面
    await expect(page).toHaveURL(`/decks/${deckId}/settings`);
    await expect(page.getByRole('heading', { name: '牌組設定', level: 1 })).toBeVisible();

    // 4. 點擊「刪除牌組」按鈕開啟確認對話框
    await page.getByRole('button', { name: '刪除牌組' }).click();

    // 驗證確認對話框顯示
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: '刪除牌組' })).toBeVisible();
    await expect(dialog.getByText('不會被刪除')).toBeVisible();
    await expect(dialog.getByText(/此操作將刪除所有卡片與學習紀錄，且無法復原/)).toBeVisible();

    // 5. 點擊對話框中的「取消」按鈕
    await dialog.getByRole('button', { name: '取消' }).click();

    // 6. 驗證對話框關閉
    await expect(dialog).not.toBeVisible();

    // 7. 驗證仍停留在設定頁面 /decks/:id/settings
    await expect(page).toHaveURL(`/decks/${deckId}/settings`);
    await expect(page.getByRole('heading', { name: '牌組設定', level: 1 })).toBeVisible();

    // 8. 導航回牌組列表頁
    await page.goto('/decks');

    // 驗證成功導航至列表頁
    await expect(page).toHaveURL('/decks');

    // 9. 驗證「不會被刪除」牌組仍在列表中
    const deckCard = page.getByRole('article').filter({ hasText: '不會被刪除' });
    await expect(deckCard).toBeVisible();

    // 10. 點擊該牌組進入詳情頁
    await deckCard.click();

    // 11. 驗證牌組可正常訪問
    await expect(page).toHaveURL(`/decks/${deckId}`);
    await expect(page.getByRole('heading', { name: '不會被刪除', level: 1 })).toBeVisible();

    // 清理：刪除測試牌組
    await request.delete(`http://localhost:3280/decks/${deckId}`);
  });
});
