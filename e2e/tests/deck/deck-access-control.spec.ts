// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('權限與安全性測試', () => {
  test('測試無法訪問其他用戶的牌組', async ({ page, request }) => {
    // 生成唯一的測試帳號
    const timestamp = Date.now();
    const userA = {
      email: `user-a-${timestamp}@test.com`,
      password: 'Test1234!',
    };
    const userB = {
      email: `user-b-${timestamp}@test.com`,
      password: 'Test1234!',
    };

    // 1. 使用 API 建立第一個測試帳號 userA 並登入
    const registerAResponse = await request.post('http://localhost:3280/auth/register', {
      data: { email: userA.email, password: userA.password }
    });
    expect(registerAResponse.ok()).toBeTruthy();

    const loginAResponse = await request.post('http://localhost:3280/auth/login', {
      data: { email: userA.email, password: userA.password }
    });
    expect(loginAResponse.ok()).toBeTruthy();

    // 2. 透過 API 為 userA 建立牌組「用戶 A 的牌組」
    // 3. 記錄該牌組的 ID
    const deckResponse = await request.post('http://localhost:3280/decks', {
      data: { name: '用戶 A 的牌組', dailyNewCards: 20, dailyReviewCards: 100 }
    });
    expect(deckResponse.ok()).toBeTruthy();
    const deckData = await deckResponse.json();
    const deckId = deckData.data.id;

    // 4. 登出
    const logoutResponse = await request.post('http://localhost:3280/auth/logout');
    expect(logoutResponse.ok()).toBeTruthy();

    // 5. 使用 API 建立第二個測試帳號 userB 並登入
    const registerBResponse = await request.post('http://localhost:3280/auth/register', {
      data: { email: userB.email, password: userB.password }
    });
    expect(registerBResponse.ok()).toBeTruthy();

    const loginBResponse = await request.post('http://localhost:3280/auth/login', {
      data: { email: userB.email, password: userB.password }
    });
    expect(loginBResponse.ok()).toBeTruthy();

    // 6. 嘗試透過 API 訪問 userA 的牌組（GET /decks/:id）
    // 7. 驗證收到 403 Forbidden 或 404 Not Found 回應
    const getResponse = await request.get(`http://localhost:3280/decks/${deckId}`);
    expect([403, 404]).toContain(getResponse.status());

    // 8. 透過 UI 登入讓 page 獲得 session cookie
    await page.goto('/login');
    await page.getByLabel('Email').fill(userB.email);
    await page.getByLabel('密碼').fill(userB.password);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL('/decks', { timeout: 10000 });

    // 9. 嘗試在瀏覽器訪問 /decks/:id（userA 的牌組 ID）
    await page.goto(`/decks/${deckId}`);

    // 10. 驗證顯示錯誤訊息或重定向
    // 檢查是否被重定向至列表頁
    await page.waitForURL(/\/(decks|login)/, { timeout: 5000 });
    const currentUrl = page.url();
    const isRedirected = !currentUrl.includes(deckId);

    expect(isRedirected).toBe(true);

    // 11. 嘗試透過 API 更新 userA 的牌組（PATCH /decks/:id）
    // 12. 驗證收到 403 或 404 回應
    const updateResponse = await request.patch(`http://localhost:3280/decks/${deckId}`, {
      data: { name: '嘗試更新的名稱' }
    });
    expect([403, 404]).toContain(updateResponse.status());

    // 13. 嘗試透過 API 刪除 userA 的牌組（DELETE /decks/:id）
    // 14. 驗證收到 403 或 404 回應
    const deleteResponse = await request.delete(`http://localhost:3280/decks/${deckId}`);
    expect([403, 404]).toContain(deleteResponse.status());
  });
});
