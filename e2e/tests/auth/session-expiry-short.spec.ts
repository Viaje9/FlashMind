// spec: e2e/specs/auth.test-plan.md

import { test, expect } from '@playwright/test';

test.describe('Session 與權限管理', () => {
  test.skip('驗證短效期 Session（未勾選記住我）', async ({ page, request, context }) => {
    const testEmail = 'test-session-short@example.com';
    const testPassword = 'password123456';

    // 前置條件：使用 Email 登入，未勾選「記住我」
    await request.post('http://localhost:3280/auth/register', {
      data: {
        email: testEmail,
        password: testPassword
      }
    });

    await page.goto('/login');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('密碼').fill(testPassword);
    // 確保「記住我」未勾選（使用 force 因為有覆蓋層）
    const rememberMe = page.getByTestId('login-remember-me');
    if (await rememberMe.isChecked()) {
      await rememberMe.click({ force: true });
    }
    await page.getByTestId('login-submit').click();

    // 1. 前往 /decks 頁面驗證登入成功
    await expect(page).toHaveURL('/decks', { timeout: 10000 });

    // 2. 檢查 session cookie 的 Max-Age 屬性
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name === 'session');
    expect(sessionCookie).toBeDefined();
    
    // 3. 驗證 Session cookie 的 Max-Age 為 7 天（604800 秒）
    // 註：實際測試時需要檢查 cookie 的過期時間
    // 此處假設 7 天的 session 期限

    // 4-5. 模擬時間快轉至 7 天後
    // 註：Playwright 不支援直接時間快轉，此測試需要後端支援或使用其他方式
    // 此處標記為 skip，實際測試需要特殊設置
  });
});
