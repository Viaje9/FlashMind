// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('整合與邊界情況測試', () => {
  test('測試特殊字元在牌組名稱', async ({ page, request }) => {
    const specialDeckName = '測試 <script>alert(\'xss\')</script> & < > " \' 牌組';

    // 1. 使用 API 建立測試帳號並登入
    const testEmail = `test-special-chars-${Date.now()}@test.com`;
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

    // 2. 導航至 /decks/new
    await page.goto('/decks/new');

    // 等待頁面加載完成
    await expect(page.getByRole('heading', { name: '新增牌組', level: 1 })).toBeVisible();

    // 3. 在牌組名稱輸入框輸入包含特殊字元的名稱「測試 <script>alert('xss')</script> & < > " ' 牌組」
    const deckNameInput = page.getByRole('textbox', { name: '牌組名稱' });
    await deckNameInput.fill(specialDeckName);

    // 4. 點擊「儲存設定」
    const saveButton = page.getByRole('button', { name: '儲存設定' });

    const responsePromise = page.waitForResponse(
      response => response.url().includes('/decks') && response.request().method() === 'POST'
    );

    await saveButton.click();

    // 5. 驗證牌組建立成功
    const response = await responsePromise;
    expect(response.status()).toBe(201);

    const responseData = await response.json();
    const newDeckId = responseData.data.id;

    // 驗證導航至牌組詳情頁
    await expect(page).toHaveURL(`/decks/${newDeckId}`, { timeout: 10000 });

    // 6. 驗證牌組名稱正確顯示且特殊字元被適當轉義（無 XSS 攻擊）
    await expect(page.getByRole('heading', { name: specialDeckName, level: 1 })).toBeVisible();

    // 檢查頁面中沒有執行 XSS 腳本（檢查是否有 alert 對話框或腳本執行）
    const hasXssExecuted = await page.evaluate(() => {
      // 檢查 DOM 中是否有未轉義的 script 標籤
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        if (script.textContent?.includes('alert(\'xss\')')) {
          return true;
        }
      }
      return false;
    });
    expect(hasXssExecuted).toBe(false);

    // 7. 導航至牌組列表
    await page.goto('/decks');

    // 等待列表頁面加載
    await expect(page.getByRole('heading', { name: 'FlashMind', level: 1 })).toBeVisible();

    // 8. 驗證列表中牌組名稱正確顯示
    await expect(page.getByText(specialDeckName)).toBeVisible();

    // 再次驗證列表頁中沒有 XSS 執行
    const hasXssInList = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        if (script.textContent?.includes('alert(\'xss\')')) {
          return true;
        }
      }
      return false;
    });
    expect(hasXssInList).toBe(false);

    // 9. 測試搜尋功能，搜尋「script」
    const searchInput = page.getByRole('textbox', { name: '搜尋牌組...' });
    await searchInput.fill('script');

    // 10. 驗證搜尋結果正確
    // 等待搜尋結果更新
    await page.waitForTimeout(500); // 等待搜尋過濾完成

    // 驗證包含 "script" 的牌組仍然顯示
    await expect(page.getByText(specialDeckName)).toBeVisible();
  });
});
