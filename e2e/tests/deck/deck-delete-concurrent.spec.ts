// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('整合與邊界情況測試', () => {
  test('測試並發刪除牌組', async ({ browser }) => {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(7);
    const testEmail = `test-concurrent-${timestamp}-${randomSuffix}@example.com`;
    const testPassword = 'Test1234!';
    let deckId: string;

    // 1. 使用 API 建立測試帳號並登入
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    
    await page1.goto('http://localhost:4280');
    
    const credentials = await page1.evaluate(async ({ email, password }) => {
      // 註冊帳號
      const registerResponse = await fetch('http://localhost:3280/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
          name: '並發測試用戶',
        }),
      });

      if (!registerResponse.ok) {
        throw new Error(`註冊失敗: ${await registerResponse.text()}`);
      }

      return { email, password };
    }, { email: testEmail, password: testPassword });

    // 2. 透過 API 建立測試牌組「並發刪除測試」
    deckId = await page1.evaluate(async () => {
      const createDeckResponse = await fetch('http://localhost:3280/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: '並發刪除測試',
          dailyNewCards: 20,
          dailyReviewCards: 100,
        }),
      });

      if (!createDeckResponse.ok) {
        throw new Error(`建立牌組失敗: ${await createDeckResponse.text()}`);
      }

      const createDeckData = await createDeckResponse.json();
      return createDeckData.data.id;
    });

    // 3. 在兩個瀏覽器 context 中登入同一帳號
    // 第一個 context 已經登入了，現在建立第二個 context
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    
    await page2.goto('http://localhost:4280');
    
    // 第二個 context 登入
    await page2.evaluate(async ({ email, password }) => {
      const loginResponse = await fetch('http://localhost:3280/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!loginResponse.ok) {
        throw new Error(`登入失敗: ${await loginResponse.text()}`);
      }
    }, credentials);

    // 4. 在第一個 context 導航至設定頁並開始刪除流程
    await page1.goto(`http://localhost:4280/decks/${deckId}/settings`);
    await expect(page1).toHaveURL(`/decks/${deckId}/settings`);
    await expect(page1.getByRole('heading', { name: '牌組設定', level: 1 })).toBeVisible();

    // 5. 在第二個 context 也導航至設定頁並開始刪除流程
    await page2.goto(`http://localhost:4280/decks/${deckId}/settings`);
    await expect(page2).toHaveURL(`/decks/${deckId}/settings`);
    await expect(page2.getByRole('heading', { name: '牌組設定', level: 1 })).toBeVisible();

    // 在兩個 context 都點擊刪除按鈕開啟對話框
    await page1.getByRole('button', { name: '刪除牌組' }).click();
    await page2.getByRole('button', { name: '刪除牌組' }).click();

    // 驗證兩個對話框都顯示
    const dialog1 = page1.getByRole('dialog');
    const dialog2 = page2.getByRole('dialog');
    await expect(dialog1).toBeVisible();
    await expect(dialog2).toBeVisible();

    // 6. 在第一個 context 點擊「確認」刪除
    const confirmButton1 = dialog1.getByRole('button', { name: /確認/ });
    
    // 7. 在第二個 context 點擊「確認」刪除
    const confirmButton2 = dialog2.getByRole('button', { name: /確認/ });
    
    // 幾乎同時點擊兩個確認按鈕
    await Promise.all([
      confirmButton1.click(),
      confirmButton2.click(),
    ]);

    // 8. 驗證其中一個成功刪除，另一個收到適當錯誤（如 404）
    // 9. 驗證兩個 context 最終都導航至列表頁
    // 等待至少一個 context 導航至列表頁
    await Promise.race([
      expect(page1).toHaveURL(/\/decks$/, { timeout: 10000 }),
      expect(page2).toHaveURL(/\/decks$/, { timeout: 10000 }),
    ]);

    // 等待另一個也完成導航（可能成功或失敗）
    const url1Promise = page1.waitForURL(/\/decks/, { timeout: 5000 }).catch(() => page1.url());
    const url2Promise = page2.waitForURL(/\/decks/, { timeout: 5000 }).catch(() => page2.url());
    await Promise.all([url1Promise, url2Promise]);

    const url1 = page1.url();
    const url2 = page2.url();

    // 兩個 context 最終都應該在列表頁或顯示錯誤
    const context1OnListPage = url1.includes('/decks') && !url1.includes('/settings') && !url1.includes(deckId);
    const context2OnListPage = url2.includes('/decks') && !url2.includes('/settings') && !url2.includes(deckId);

    // 至少有一個應該成功導航至列表頁
    expect(context1OnListPage || context2OnListPage).toBe(true);

    // 10. 驗證牌組不再存在於列表中
    // 在成功導航到列表頁的 context 中驗證
    const pageToCheck = context1OnListPage ? page1 : page2;
    
    // 確保在列表頁
    if (!pageToCheck.url().includes('/decks') || pageToCheck.url().includes('/settings')) {
      await pageToCheck.goto('http://localhost:4280/decks');
    }
    
    // 等待頁面載入完成
    await expect(pageToCheck.getByRole('heading', { name: 'FlashMind', level: 1 })).toBeVisible();
    
    // 驗證牌組不在列表中（可能顯示空狀態或其他牌組）
    const deletedDeckText = pageToCheck.getByText('並發刪除測試');
    await expect(deletedDeckText).not.toBeVisible();

    // 清理
    await context1.close();
    await context2.close();
  });
});
