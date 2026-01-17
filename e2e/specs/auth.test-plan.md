# FlashMind 認證功能測試計畫

## Application Overview

FlashMind 是一個智慧閃卡學習應用程式，使用 FSRS 演算法進行間隔重複學習排程。此測試計畫涵蓋完整的使用者認證功能，包括 Email 註冊登入、Google OAuth 登入、登出、以及「記住我」功能。所有測試均採用 HttpOnly Cookie 作為認證機制，符合 ADR-016 API 設計規範。

## 測試環境
- 前端：Angular 21, http://localhost:4200
- 後端：NestJS 11, Prisma 6, PostgreSQL
- 測試工具：Playwright
- API 認證：HttpOnly Cookie (session)

## API 端點
- POST /auth/register - 註冊
- POST /auth/login - 登入
- POST /auth/logout - 登出
- GET /auth/google - 發起 Google OAuth
- GET /auth/google/callback - Google OAuth callback
- GET /auth/me - 取得目前使用者

## 前端路由
- /welcome - 歡迎頁面
- /login - 登入頁面
- /register - 註冊頁面
- /settings - 設定頁面
- /decks - 牌組列表（受保護路由）

## Test Scenarios

### 1. Email 註冊功能

**Seed:** `e2e/seed.spec.ts`

#### 1.1. 成功使用 Email 註冊新帳號

**File:** `e2e/auth/email-registration.spec.ts`

**Steps:**
  1. 前往歡迎頁面 /welcome
  2. 點擊「開始使用」按鈕
  3. 驗證頁面導向至 /register
  4. 在 Email 欄位輸入唯一的測試 Email（例如 test-{timestamp}@example.com）
  5. 在密碼欄位輸入 password123456
  6. 在確認密碼欄位輸入 password123456
  7. 點擊「註冊」按鈕
  8. 等待註冊請求完成

**Expected Results:**
  - 成功導向至 /decks 牌組列表頁面
  - 瀏覽器設定 session cookie（HttpOnly, Secure, SameSite）
  - 導航列顯示使用者資訊
  - 後端成功建立使用者記錄（primaryProvider: email）
  - 密碼以 bcrypt 雜湊儲存於資料庫

#### 1.2. 註冊時密碼長度驗證（少於 8 字元）

**File:** `e2e/auth/email-registration-validation.spec.ts`

**Steps:**
  1. 前往註冊頁面 /register
  2. 在 Email 欄位輸入 test@example.com
  3. 在密碼欄位輸入 pass123（7 字元）
  4. 在確認密碼欄位輸入 pass123
  5. 點擊密碼欄位外部觸發 blur 驗證

**Expected Results:**
  - 密碼欄位下方顯示錯誤訊息「密碼至少需要 8 個字元」
  - 前端表單驗證攔截，不發送 API 請求
  - 註冊按鈕保持禁用狀態或點擊無效
  - 使用者停留在 /register 頁面

#### 1.3. 註冊時密碼與確認密碼不一致

**File:** `e2e/auth/email-registration-validation.spec.ts`

**Steps:**
  1. 前往註冊頁面 /register
  2. 在 Email 欄位輸入 test@example.com
  3. 在密碼欄位輸入 password123456
  4. 在確認密碼欄位輸入 password654321（不一致）
  5. 點擊確認密碼欄位外部觸發驗證

**Expected Results:**
  - 確認密碼欄位下方顯示錯誤訊息「密碼與確認密碼不一致」
  - 前端表單驗證攔截，不發送 API 請求
  - 使用者停留在 /register 頁面

#### 1.4. 註冊時 Email 格式驗證

**File:** `e2e/auth/email-registration-validation.spec.ts`

**Steps:**
  1. 前往註冊頁面 /register
  2. 在 Email 欄位輸入 invalid-email（無效格式）
  3. 在密碼欄位點擊觸發 blur 事件

**Expected Results:**
  - Email 欄位下方顯示錯誤訊息「請輸入有效的 Email 格式」
  - 前端表單驗證攔截，不發送 API 請求
  - Email 欄位維持錯誤狀態

#### 1.5. 註冊時 Email 已被使用（409 錯誤）

**File:** `e2e/auth/email-registration-conflict.spec.ts`

**Steps:**
  1. 前置條件：在資料庫建立測試帳號 existing@example.com
  2. 前往註冊頁面 /register
  3. 在 Email 欄位輸入 existing@example.com
  4. 在密碼欄位輸入 password123456
  5. 在確認密碼欄位輸入 password123456
  6. 點擊「註冊」按鈕
  7. 等待 API 回應

**Expected Results:**
  - 頁面頂部顯示錯誤訊息「此 Email 已被註冊」
  - 使用者停留在 /register 頁面
  - API 回傳 409 Conflict
  - 錯誤回應符合規範：{ error: { code: 'AUTH_EMAIL_ALREADY_EXISTS', message: '此 Email 已被註冊' } }

#### 1.6. 從註冊頁面切換至登入頁面

**File:** `e2e/auth/email-registration-navigation.spec.ts`

**Steps:**
  1. 前往註冊頁面 /register
  2. 點擊頁面標題右側的「登入現有帳號」連結
  3. 驗證導向至 /login 頁面

**Expected Results:**
  - 成功導向至登入頁面
  - 頁面顯示「登入帳號」標題
  - 表單欄位清空

### 2. Email 登入功能

**Seed:** `e2e/seed.spec.ts`

#### 2.1. 成功使用 Email 登入

**File:** `e2e/auth/email-login.spec.ts`

**Steps:**
  1. 前置條件：在資料庫建立測試帳號 test@example.com / password123456
  2. 前往登入頁面 /login
  3. 驗證頁面顯示「登入帳號」標題
  4. 在 Email 欄位輸入 test@example.com
  5. 在密碼欄位輸入 password123456
  6. 確認「記住我」勾選框未勾選
  7. 點擊「登入」按鈕
  8. 等待登入請求完成

**Expected Results:**
  - 成功導向至 /decks 牌組列表頁面
  - 瀏覽器設定短效期 session cookie（預設 7 天）
  - 導航列顯示使用者資訊
  - 資料庫更新 User.lastLoginAt 時間戳記
  - API 回傳 200 OK 並包含使用者資料

#### 2.2. 登入時勾選「記住我」選項

**File:** `e2e/auth/email-login-remember-me.spec.ts`

**Steps:**
  1. 前置條件：在資料庫建立測試帳號 test@example.com / password123456
  2. 前往登入頁面 /login
  3. 在 Email 欄位輸入 test@example.com
  4. 在密碼欄位輸入 password123456
  5. 勾選「記住我」勾選框
  6. 驗證勾選框狀態為已勾選
  7. 點擊「登入」按鈕
  8. 等待登入請求完成

**Expected Results:**
  - 成功導向至 /decks 頁面
  - 瀏覽器設定長效期 session cookie（30 天）
  - API 請求 body 包含 rememberMe: true
  - 後端設定 session.expiresAt 為 30 天後

#### 2.3. 登入時 Email 不存在（401 錯誤）

**File:** `e2e/auth/email-login-invalid-credentials.spec.ts`

**Steps:**
  1. 前往登入頁面 /login
  2. 在 Email 欄位輸入 nonexistent@example.com（不存在的 Email）
  3. 在密碼欄位輸入 anypassword123
  4. 點擊「登入」按鈕
  5. 等待 API 回應

**Expected Results:**
  - 頁面頂部顯示錯誤訊息「Email 或密碼錯誤」
  - 使用者停留在 /login 頁面
  - API 回傳 401 Unauthorized
  - 錯誤回應符合規範：{ error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Email 或密碼錯誤' } }

#### 2.4. 登入時密碼錯誤（401 錯誤）

**File:** `e2e/auth/email-login-invalid-credentials.spec.ts`

**Steps:**
  1. 前置條件：在資料庫建立測試帳號 test@example.com / password123456
  2. 前往登入頁面 /login
  3. 在 Email 欄位輸入 test@example.com
  4. 在密碼欄位輸入 wrongpassword（錯誤密碼）
  5. 點擊「登入」按鈕
  6. 等待 API 回應

**Expected Results:**
  - 頁面頂部顯示錯誤訊息「Email 或密碼錯誤」
  - 使用者停留在 /login 頁面
  - API 回傳 401 Unauthorized
  - 密碼欄位內容不清空（保持原樣）

#### 2.5. 登入時 Email 格式驗證

**File:** `e2e/auth/email-login-validation.spec.ts`

**Steps:**
  1. 前往登入頁面 /login
  2. 在 Email 欄位輸入 invalid-email（無效格式）
  3. 在密碼欄位點擊觸發 blur 事件

**Expected Results:**
  - Email 欄位下方顯示錯誤訊息「請輸入有效的 Email 格式」
  - 前端表單驗證攔截，不發送 API 請求
  - Email 欄位維持錯誤狀態

#### 2.6. 登入時必填欄位驗證

**File:** `e2e/auth/email-login-validation.spec.ts`

**Steps:**
  1. 前往登入頁面 /login
  2. Email 欄位留空
  3. 在密碼欄位輸入 password123456
  4. 點擊「登入」按鈕

**Expected Results:**
  - Email 欄位顯示錯誤訊息「請輸入 Email」
  - 前端表單驗證攔截，不發送 API 請求
  - 使用者停留在 /login 頁面

#### 2.7. 從登入頁面切換至註冊頁面

**File:** `e2e/auth/email-login-navigation.spec.ts`

**Steps:**
  1. 前往登入頁面 /login
  2. 點擊頁面標題右側的「註冊新帳號」連結
  3. 驗證導向至 /register 頁面

**Expected Results:**
  - 成功導向至註冊頁面
  - 頁面顯示「註冊帳號」標題
  - 表單欄位清空

### 3. Google OAuth 登入功能

**Seed:** `e2e/seed.spec.ts`

#### 3.1. 從歡迎頁面發起 Google OAuth 登入

**File:** `e2e/auth/google-oauth-welcome.spec.ts`

**Steps:**
  1. 前往歡迎頁面 /welcome
  2. 驗證頁面顯示「其他登入方式」區塊
  3. 驗證 Google 登入按鈕存在（帶有 Google icon）
  4. 點擊 Google 登入按鈕

**Expected Results:**
  - 瀏覽器導向至 /auth/google（後端端點）
  - 後端重新導向至 Google OAuth 授權頁面（302 redirect）
  - 授權 URL 包含正確的 client_id、redirect_uri、scope 參數
  - state 參數包含 rememberMe=false（未勾選記住我）

#### 3.2. 從登入頁面發起 Google OAuth 登入

**File:** `e2e/auth/google-oauth-login.spec.ts`

**Steps:**
  1. 前往登入頁面 /login
  2. 驗證頁面顯示「或使用其他方式登入」分隔線
  3. 驗證 Google 登入按鈕存在
  4. 確認「記住我」勾選框未勾選
  5. 點擊 Google 登入按鈕

**Expected Results:**
  - 瀏覽器導向至 /auth/google?rememberMe=false
  - 後端重新導向至 Google OAuth 授權頁面
  - state 參數包含 rememberMe=false

#### 3.3. 從登入頁面發起 Google OAuth 登入（勾選記住我）

**File:** `e2e/auth/google-oauth-login-remember-me.spec.ts`

**Steps:**
  1. 前往登入頁面 /login
  2. 勾選「記住我」勾選框
  3. 驗證勾選框狀態為已勾選
  4. 點擊 Google 登入按鈕

**Expected Results:**
  - 瀏覽器導向至 /auth/google?rememberMe=true
  - state 參數包含 rememberMe=true
  - 後續 callback 設定長效期 session

#### 3.4. 從註冊頁面發起 Google OAuth 登入

**File:** `e2e/auth/google-oauth-register.spec.ts`

**Steps:**
  1. 前往註冊頁面 /register
  2. 驗證頁面顯示「或使用其他方式註冊」分隔線
  3. 驗證 Google 登入按鈕存在
  4. 點擊 Google 登入按鈕

**Expected Results:**
  - 瀏覽器導向至 /auth/google
  - 後端重新導向至 Google OAuth 授權頁面

#### 3.5. Google OAuth Callback 成功（新使用者）

**File:** `e2e/auth/google-oauth-callback-new-user.spec.ts`

**Steps:**
  1. 模擬 Google OAuth 授權完成
  2. 瀏覽器導向至 /auth/google/callback?code=MOCK_AUTH_CODE&state=MOCK_STATE
  3. 後端驗證授權碼並取得 Google 使用者資訊
  4. 後端建立新使用者記錄（primaryProvider: google）
  5. 後端建立 OAuthAccount 記錄連結 Google provider
  6. 後端建立 session 並設定 cookie

**Expected Results:**
  - 後端重新導向至前端 /decks 頁面（302）
  - 瀏覽器設定 session cookie（HttpOnly）
  - 資料庫建立使用者記錄（email 來自 Google, passwordHash 為 null）
  - 資料庫建立 OAuthAccount 記錄（provider: google, providerAccountId: Google User ID）
  - 使用者成功登入並進入主頁面

#### 3.6. Google OAuth Callback 成功（既有使用者）

**File:** `e2e/auth/google-oauth-callback-existing-user.spec.ts`

**Steps:**
  1. 前置條件：資料庫已存在使用相同 Google 帳號的使用者
  2. 模擬 Google OAuth 授權完成
  3. 瀏覽器導向至 /auth/google/callback?code=MOCK_AUTH_CODE&state=MOCK_STATE
  4. 後端驗證授權碼並取得 Google 使用者資訊
  5. 後端查詢到既有 OAuthAccount 記錄
  6. 後端更新 User.lastLoginAt

**Expected Results:**
  - 後端重新導向至前端 /decks 頁面
  - 瀏覽器設定新 session cookie
  - 不建立重複的使用者或 OAuthAccount 記錄
  - 使用者成功登入

#### 3.7. Google OAuth 授權失敗（使用者取消授權）

**File:** `e2e/auth/google-oauth-callback-error.spec.ts`

**Steps:**
  1. 模擬使用者在 Google 授權頁面點擊「取消」
  2. 瀏覽器導向至 /auth/google/callback?error=access_denied
  3. 後端處理錯誤

**Expected Results:**
  - 後端重新導向至前端 /login?error=google_auth_failed
  - 前端登入頁面顯示錯誤訊息「Google 登入失敗，請重試」
  - 不建立使用者或 session 記錄

### 4. 登出功能

**Seed:** `e2e/seed.spec.ts`

#### 4.1. 從設定頁面登出

**File:** `e2e/auth/logout.spec.ts`

**Steps:**
  1. 前置條件：使用者已登入（使用 test@example.com）
  2. 前往設定頁面 /settings
  3. 驗證頁面顯示使用者資訊（Email: test@example.com）
  4. 捲動至頁面底部
  5. 驗證「登出帳戶」按鈕存在（紅色危險按鈕）
  6. 點擊「登出帳戶」按鈕
  7. 等待登出請求完成

**Expected Results:**
  - 成功導向至 /welcome 歡迎頁面
  - session cookie 被清除（Max-Age=0）
  - 後端撤銷資料庫中的 session 記錄
  - API 回傳 204 No Content
  - 導航列不再顯示使用者資訊

#### 4.2. 登出後無法存取受保護頁面

**File:** `e2e/auth/logout-redirect.spec.ts`

**Steps:**
  1. 前置條件：使用者已登入並登出
  2. 手動導向至 /decks 頁面（受保護路由）
  3. 前端 AuthGuard 攔截請求

**Expected Results:**
  - 自動導向至 /login 頁面
  - 頁面顯示登入表單
  - 無法進入 /decks 頁面

#### 4.3. 登出時顯示載入狀態

**File:** `e2e/auth/logout-loading-state.spec.ts`

**Steps:**
  1. 前置條件：使用者已登入
  2. 前往設定頁面 /settings
  3. 點擊「登出帳戶」按鈕
  4. 在 API 回應前觀察按鈕狀態

**Expected Results:**
  - 按鈕文字變更為「登出中...」
  - 按鈕呈現禁用狀態（disabled）
  - 登出完成後導向歡迎頁面

### 5. Session 與權限管理

**Seed:** `e2e/seed.spec.ts`

#### 5.1. 驗證短效期 Session（未勾選記住我）

**File:** `e2e/auth/session-expiry-short.spec.ts`

**Steps:**
  1. 前置條件：使用 Email 登入，未勾選「記住我」
  2. 前往 /decks 頁面驗證登入成功
  3. 檢查 session cookie 的 Max-Age 屬性
  4. 模擬時間快轉至 7 天後
  5. 重新整理頁面並發送 /auth/me 請求

**Expected Results:**
  - Session cookie 的 Max-Age 為 7 天（604800 秒）
  - 7 天內訪問頁面維持登入狀態
  - 7 天後 session 過期，/auth/me 回傳 401
  - 自動導向至 /login 頁面

#### 5.2. 驗證長效期 Session（勾選記住我）

**File:** `e2e/auth/session-expiry-long.spec.ts`

**Steps:**
  1. 前置條件：使用 Email 登入，勾選「記住我」
  2. 前往 /decks 頁面驗證登入成功
  3. 檢查 session cookie 的 Max-Age 屬性
  4. 模擬時間快轉至 30 天後
  5. 重新整理頁面並發送 /auth/me 請求

**Expected Results:**
  - Session cookie 的 Max-Age 為 30 天（2592000 秒）
  - 30 天內訪問頁面維持登入狀態
  - 30 天後 session 過期，/auth/me 回傳 401

#### 5.3. 未登入時存取受保護頁面自動導向登入

**File:** `e2e/auth/auth-guard-redirect.spec.ts`

**Steps:**
  1. 前置條件：使用者未登入
  2. 清除所有 cookies
  3. 手動導向至 /decks 頁面
  4. 前端 AuthGuard 檢查認證狀態
  5. 呼叫 /auth/me API

**Expected Results:**
  - API 回傳 401 Unauthorized
  - 前端自動導向至 /login 頁面
  - 無法進入 /decks 頁面

#### 5.4. 已登入時存取登入頁面自動導向主頁

**File:** `e2e/auth/already-logged-in-redirect.spec.ts`

**Steps:**
  1. 前置條件：使用者已登入
  2. 手動導向至 /login 頁面
  3. 前端檢查認證狀態

**Expected Results:**
  - 自動導向至 /decks 頁面
  - 不顯示登入表單

#### 5.5. Session Cookie 安全屬性驗證

**File:** `e2e/auth/session-cookie-security.spec.ts`

**Steps:**
  1. 前置條件：使用 Email 登入成功
  2. 檢查瀏覽器中的 session cookie 屬性

**Expected Results:**
  - Cookie 名稱為 'session'
  - HttpOnly 屬性為 true（無法透過 JavaScript 存取）
  - Secure 屬性為 true（僅透過 HTTPS 傳輸，開發環境可能為 false）
  - SameSite 屬性為 Strict 或 Lax
  - Path 為 /

### 6. UI/UX 與使用者體驗

**Seed:** `e2e/seed.spec.ts`

#### 6.1. 登入表單 Enter 鍵提交

**File:** `e2e/auth/login-keyboard-submit.spec.ts`

**Steps:**
  1. 前往登入頁面 /login
  2. 在 Email 欄位輸入 test@example.com
  3. 在密碼欄位輸入 password123456
  4. 在密碼欄位中按下 Enter 鍵

**Expected Results:**
  - 表單自動提交
  - 觸發登入 API 請求
  - 成功登入並導向 /decks

#### 6.2. 註冊表單 Enter 鍵提交

**File:** `e2e/auth/register-keyboard-submit.spec.ts`

**Steps:**
  1. 前往註冊頁面 /register
  2. 填寫完整註冊資訊
  3. 在確認密碼欄位中按下 Enter 鍵

**Expected Results:**
  - 表單自動提交
  - 觸發註冊 API 請求
  - 成功註冊並導向 /decks

#### 6.3. 登入載入狀態 UI 回饋

**File:** `e2e/auth/login-loading-ui.spec.ts`

**Steps:**
  1. 前往登入頁面 /login
  2. 填寫登入資訊
  3. 點擊「登入」按鈕
  4. 在 API 回應前觀察按鈕狀態

**Expected Results:**
  - 按鈕文字變更為「登入中...」
  - 按鈕呈現禁用狀態（disabled）
  - 登入成功後按鈕恢復正常並導向頁面

#### 6.4. 註冊載入狀態 UI 回饋

**File:** `e2e/auth/register-loading-ui.spec.ts`

**Steps:**
  1. 前往註冊頁面 /register
  2. 填寫完整註冊資訊
  3. 點擊「註冊」按鈕
  4. 在 API 回應前觀察按鈕狀態

**Expected Results:**
  - 按鈕文字變更為「註冊中...」
  - 按鈕呈現禁用狀態
  - 註冊成功後導向頁面

#### 6.5. 錯誤訊息顯示與清除

**File:** `e2e/auth/error-message-display.spec.ts`

**Steps:**
  1. 前往登入頁面 /login
  2. 輸入錯誤的帳密並提交
  3. 驗證頁面顯示錯誤訊息
  4. 修正 Email 和密碼為正確值
  5. 再次點擊「登入」按鈕

**Expected Results:**
  - 第一次提交後顯示錯誤訊息「Email 或密碼錯誤」
  - 第二次提交前錯誤訊息自動清除
  - 第二次提交成功後導向 /decks
  - 不顯示任何錯誤訊息

#### 6.6. 表單欄位 Focus 順序

**File:** `e2e/auth/form-field-focus.spec.ts`

**Steps:**
  1. 前往登入頁面 /login
  2. 按下 Tab 鍵導航表單欄位
  3. 依序觀察 focus 順序

**Expected Results:**
  - Focus 順序為：Email → 密碼 → 記住我勾選框 → 登入按鈕 → 註冊新帳號連結 → Google 登入按鈕
  - 所有互動元素均可透過鍵盤存取
  - 符合無障礙標準（Accessibility）
