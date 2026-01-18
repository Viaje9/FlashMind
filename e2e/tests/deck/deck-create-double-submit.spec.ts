// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('整合與邊界情況測試', () => {
  test('測試快速連續點擊儲存按鈕', async ({ page, request }) => {
    // 1. 使用 API 建立測試帳號並登入
    const testEmail = `test-double-submit-${Date.now()}@test.com`;
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

    // 透過 UI 登入讓 page 獲得 session cookie
    await page.goto('/login');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('密碼').fill(testPassword);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL('/decks', { timeout: 10000 });

    // 設置請求計數器
    let postRequestCount = 0;
    let createDeckResponse: any = null;

    // 設置路由監聽 - 攔截 POST /decks 請求
    await page.route('**/decks', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        postRequestCount++;
        // 繼續執行原本的請求
        const response = await route.fetch();
        if (postRequestCount === 1) {
          // 保存第一次請求的回應
          createDeckResponse = await response.json();
        }
        await route.fulfill({ response });
      } else {
        await route.continue();
      }
    });

    // 2. 導航至 /decks/new
    await page.goto('/decks/new');

    // 等待頁面加載完成
    await expect(page.getByRole('heading', { name: '新增牌組', level: 1 })).toBeVisible();

    // 3. 在牌組名稱輸入框輸入「重複提交測試」
    const deckNameInput = page.getByRole('textbox', { name: '牌組名稱' });
    await deckNameInput.fill('重複提交測試');

    // 4. 快速連續點擊「儲存設定」按鈕兩次
    const saveButton = page.getByRole('button', { name: '儲存設定' });

    // 快速連續點擊
    await saveButton.click();
    await saveButton.click();

    // 等待導航完成
    await page.waitForURL(/\/decks\/\d+/, { timeout: 10000 });

    // 5. 驗證只發送一次 API 請求
    expect(postRequestCount).toBe(1);

    // 6. 驗證只建立一個牌組
    expect(createDeckResponse).not.toBeNull();
    expect(createDeckResponse.data.name).toBe('重複提交測試');
    const newDeckId = createDeckResponse.data.id;

    // 7. 導航至列表頁驗證只有一個「重複提交測試」牌組
    await page.goto('/decks');

    // 等待列表加載
    await page.waitForSelector('[data-testid="deck-item"]', { timeout: 10000 });

    // 查找所有名為「重複提交測試」的牌組
    const deckItems = await page.locator('[data-testid="deck-item"]').all();
    let matchingDecksCount = 0;

    for (const item of deckItems) {
      const nameElement = item.locator('[data-testid="deck-name"]');
      const name = await nameElement.textContent();
      if (name?.trim() === '重複提交測試') {
        matchingDecksCount++;
      }
    }

    // 驗證只有一個該名稱的牌組
    expect(matchingDecksCount).toBe(1);
  });
});
