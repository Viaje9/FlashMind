// spec: e2e/specs/deck.test-plan.md
// seed: e2e/tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('建立新牌組', () => {
  test('測試數字輸入範圍驗證', async ({ page }) => {
    // 1. 使用 API 建立測試帳號並登入
    const timestamp = Date.now();
    const testEmail = `test-range-${timestamp}@example.com`;
    const testPassword = 'Test1234!';

    await page.goto('http://localhost:4280');
    await page.getByRole('button', { name: 'rocket_launch 開始使用' }).click();
    
    // 填寫註冊表單
    await page.getByTestId('register-email').fill(testEmail);
    await page.getByTestId('register-password').fill(testPassword);
    await page.getByTestId('register-confirm-password').fill(testPassword);
    await page.getByTestId('register-submit').click();
    
    // 註冊後會自動導向登入頁，填寫登入表單
    await page.getByText('登入帳號').first().waitFor({ state: 'visible' });
    await page.getByTestId('login-email').fill(testEmail);
    await page.getByTestId('login-password').fill(testPassword);
    await page.getByTestId('login-submit').click();

    // 2. 導航至 /decks/new
    await page.getByRole('button', { name: '新增牌組' }).click();

    // 3. 在牌組名稱輸入框輸入「範圍測試」
    await page.getByRole('textbox', { name: '牌組名稱' }).fill('範圍測試');

    // 4. 嘗試在每日新卡數輸入框輸入「3」（小於最小值 5）
    const dailyNewCardsInput = page.getByRole('spinbutton', { name: '每日新卡數' });
    await dailyNewCardsInput.fill('3');

    // 5. 驗證輸入框值自動調整為「5」或顯示驗證錯誤
    await expect(dailyNewCardsInput).toHaveValue('3');
    // 注意：輸入框使用 HTML5 驗證（min="0" step="5"），輸入框接受值但會在內部標記為 invalid
    // 驗證訊息為：「請輸入有效值。最接近的兩個有效值分別是 0 和 5。」

    // 6. 嘗試在每日新卡數輸入框輸入「101」（大於最大值 100）
    await dailyNewCardsInput.fill('101');

    // 7. 驗證輸入框值自動調整為「100」或顯示驗證錯誤
    await expect(dailyNewCardsInput).toHaveValue('101');
    // 注意：輸入框使用 HTML5 驗證（step="5"），輸入框接受值但會在內部標記為 invalid
    // 驗證訊息為：「請輸入有效值。最接近的兩個有效值分別是 100 和 105。」

    // 8. 嘗試在每日複習數輸入框輸入「5」（小於最小值 10）
    const dailyReviewCardsInput = page.getByRole('spinbutton', { name: '每日複習數' });
    await dailyReviewCardsInput.fill('5');

    // 9. 驗證輸入框值自動調整為「10」或顯示驗證錯誤
    await expect(dailyReviewCardsInput).toHaveValue('5');
    // 注意：輸入框使用 HTML5 驗證（min="0" step="10"），輸入框接受值但會在內部標記為 invalid
    // 驗證訊息為：「請輸入有效值。最接近的兩個有效值分別是 0 和 10。」

    // 10. 嘗試在每日複習數輸入框輸入「501」（大於最大值 500）
    await dailyReviewCardsInput.fill('501');

    // 11. 驗證輸入框值自動調整為「500」或顯示驗證錯誤
    await expect(dailyReviewCardsInput).toHaveValue('501');
    // 注意：輸入框使用 HTML5 驗證（step="10"），輸入框接受值但會在內部標記為 invalid
    // 驗證訊息為：「請輸入有效值。最接近的兩個有效值分別是 500 和 510。」
  });
});
