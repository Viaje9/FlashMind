// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('整合與邊界情況測試', () => {
  test('測試建立大量牌組', async ({ page, request }) => {
    // 1. 使用 API 建立測試帳號並登入
    const testEmail = `test-${Date.now()}@test.com`;
    const testPassword = 'Test1234!';
    
    const registerResponse = await request.post('http://localhost:3280/auth/register', {
      data: {
        email: testEmail,
        password: testPassword,
        name: '測試用戶'
      }
    });
    
    expect(registerResponse.ok()).toBeTruthy();
    
    const loginResponse = await request.post('http://localhost:3280/auth/login', {
      data: {
        email: testEmail,
        password: testPassword
      }
    });
    
    expect(loginResponse.ok()).toBeTruthy();

    // 2. 透過 API 連續建立 20 個牌組（名稱為「牌組 1」到「牌組 20」）
    const deckPromises = [];
    for (let i = 1; i <= 20; i++) {
      deckPromises.push(
        request.post('http://localhost:3280/decks', {
          data: {
            name: `牌組 ${i}`,
            description: `測試牌組 ${i}`,
            dailyNewCards: 20,
            dailyReviewCards: 100
          }
        })
      );
    }
    
    const deckResponses = await Promise.all(deckPromises);
    
    for (const response of deckResponses) {
      expect(response.ok()).toBeTruthy();
    }

    // 3. 導航至牌組列表頁
    await page.goto('http://localhost:4280/decks');

    // 4. 驗證頁面能正確顯示所有 20 個牌組
    for (let i = 1; i <= 20; i++) {
      await expect(page.getByText(`牌組 ${i}`)).toBeVisible();
    }

    // 5. 驗證頁面滾動功能正常
    const pageHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    
    if (pageHeight > viewportHeight) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.evaluate(() => window.scrollTo(0, 0));
    }

    // 6. 測試搜尋功能，搜尋「牌組 1」
    const searchInput = page.getByRole('textbox', { name: '搜尋牌組' });
    await searchInput.fill('牌組 1');

    // 7. 驗證只顯示相關牌組（牌組 1, 10-19 包含「牌組 1」字串）
    const expectedDecks = [1, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    const unexpectedDecks = [2, 3, 4, 5, 6, 7, 8, 9, 20];

    for (const num of expectedDecks) {
      await expect(page.getByText(`牌組 ${num}`)).toBeVisible();
    }

    for (const num of unexpectedDecks) {
      await expect(page.getByText(`牌組 ${num}`)).not.toBeVisible();
    }
  });
});
