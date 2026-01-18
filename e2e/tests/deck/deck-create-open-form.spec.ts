// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('建立新牌組', () => {
  test('測試開啟建立表單', async ({ page, request }) => {
    // 1. 使用 API 建立測試帳號並登入
    const testEmail = `test-create-form-${Date.now()}@test.com`;
    const testPassword = 'password123456';
    
    const registerResponse = await request.post('http://localhost:3280/auth/register', {
      data: { email: testEmail, password: testPassword }
    });
    expect(registerResponse.ok()).toBeTruthy();
    
    // 登入
    await page.goto('http://localhost:4280/login');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('密碼').fill(testPassword);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL('/decks', { timeout: 10000 });
    
    // 2. 在牌組列表頁面點擊右下角「新增牌組」按鈕（+ 圖示）
    await page.getByRole('button', { name: '新增牌組' }).click();
    
    // 3. 驗證導航至 /decks/new
    await expect(page).toHaveURL('/decks/new');
    
    // 等待頁面加載完成
    await page.getByText('新增牌組').first().waitFor({ state: 'visible' });
    
    // 4. 驗證頁面標題顯示「新增牌組」
    await expect(page.getByRole('heading', { name: '新增牌組', level: 1 })).toBeVisible();
    
    // 5. 驗證返回按鈕顯示
    await expect(page.getByRole('button', { name: '返回' })).toBeVisible();
    
    // 6. 驗證牌組名稱輸入框顯示，placeholder 為「例如：日文 N5 單字」
    const deckNameInput = page.getByRole('textbox', { name: '牌組名稱' });
    await expect(deckNameInput).toBeVisible();
    await expect(deckNameInput).toHaveAttribute('placeholder', '例如：日文 N5 單字');
    
    // 7. 驗證「學習計畫設定」標題顯示
    await expect(page.getByRole('heading', { name: '學習計畫設定', level: 3 })).toBeVisible();
    
    // 8. 驗證「每日新卡數」數字輸入框顯示，預設值為 20
    const dailyNewCardsInput = page.getByRole('spinbutton', { name: '每日新卡數' });
    await expect(dailyNewCardsInput).toBeVisible();
    await expect(dailyNewCardsInput).toHaveValue('20');
    
    // 9. 驗證「每日複習數」數字輸入框顯示，預設值為 100
    const dailyReviewCardsInput = page.getByRole('spinbutton', { name: '每日複習數' });
    await expect(dailyReviewCardsInput).toBeVisible();
    await expect(dailyReviewCardsInput).toHaveValue('100');
    
    // 10. 驗證提示文字顯示
    await expect(page.getByText(/您可以隨時在牌組設定中更改這些數值/)).toBeVisible();
    
    // 11. 驗證「儲存設定」按鈕顯示
    await expect(page.getByRole('button', { name: '儲存設定' })).toBeVisible();
    
    // 12. 驗證「取消」按鈕顯示
    await expect(page.getByRole('button', { name: '取消' })).toBeVisible();
  });
});
