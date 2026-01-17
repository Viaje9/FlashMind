# Capability: 帳號與登入 (Account Auth)

## ADDED Requirements

### Requirement: Email 註冊

使用者 SHALL 能夠使用 Email 和密碼註冊新帳號。

#### Scenario: 成功註冊

- **WHEN** 使用者提供有效的 Email 和密碼（至少 8 字元）
- **THEN** 系統建立新帳號
- **AND** 自動登入並設定 session cookie
- **AND** 導向主介面（牌組列表）

#### Scenario: Email 已被使用

- **WHEN** 使用者提供的 Email 已存在於系統中
- **THEN** 顯示錯誤訊息「此 Email 已被註冊」
- **AND** 不建立新帳號

#### Scenario: 密碼格式不符

- **WHEN** 使用者提供的密碼少於 8 字元
- **THEN** 顯示錯誤訊息「密碼至少需要 8 個字元」
- **AND** 不建立新帳號

---

### Requirement: Email 登入

使用者 SHALL 能夠使用 Email 和密碼登入現有帳號。

#### Scenario: 成功登入

- **WHEN** 使用者提供正確的 Email 和密碼
- **THEN** 系統驗證成功並設定 session cookie
- **AND** 導向主介面（牌組列表）

#### Scenario: 成功登入並記住我

- **WHEN** 使用者提供正確的 Email 和密碼
- **AND** 勾選「記住我」選項
- **THEN** 系統設定 session cookie 效期為 30 天
- **AND** 導向主介面

#### Scenario: 帳密錯誤

- **WHEN** 使用者提供的 Email 不存在或密碼錯誤
- **THEN** 顯示錯誤訊息「Email 或密碼錯誤」
- **AND** 不建立 session

---

### Requirement: Google OAuth 登入

使用者 SHALL 能夠使用 Google 帳號登入或註冊。

#### Scenario: 新使用者首次 Google 登入

- **WHEN** 使用者點擊 Google 登入按鈕
- **AND** 完成 Google 授權流程
- **AND** 該 Google 帳號尚未關聯任何帳號
- **THEN** 系統建立新帳號（使用 Google Email）
- **AND** 設定 session cookie
- **AND** 導向主介面

#### Scenario: 現有使用者 Google 登入

- **WHEN** 使用者點擊 Google 登入按鈕
- **AND** 完成 Google 授權流程
- **AND** 該 Google 帳號已關聯現有帳號
- **THEN** 系統驗證成功並設定 session cookie
- **AND** 導向主介面

#### Scenario: 使用者取消 Google 授權

- **WHEN** 使用者在 Google 授權頁面點擊取消
- **THEN** 導向登入頁面
- **AND** 顯示訊息「已取消 Google 登入」

---

### Requirement: 登出

已登入使用者 SHALL 能夠登出帳號。

#### Scenario: 成功登出

- **WHEN** 使用者在設定頁面點擊登出按鈕
- **THEN** 系統撤銷目前 session
- **AND** 清除 session cookie
- **AND** 導向歡迎頁面

---

### Requirement: Session 管理

系統 SHALL 安全管理使用者登入狀態。

#### Scenario: Session 有效期內存取

- **WHEN** 使用者在 session 有效期內存取受保護頁面
- **THEN** 系統驗證 session 並允許存取

#### Scenario: Session 過期

- **WHEN** 使用者的 session 已過期
- **AND** 嘗試存取受保護頁面
- **THEN** 系統導向登入頁面
- **AND** 顯示訊息「登入已過期，請重新登入」

#### Scenario: 未登入存取受保護頁面

- **WHEN** 未登入使用者嘗試存取受保護頁面
- **THEN** 系統導向登入頁面

---

### Requirement: 服務條款與隱私權政策

註冊頁面 SHALL 顯示服務條款與隱私權政策連結。

#### Scenario: 顯示法律連結

- **WHEN** 使用者瀏覽註冊頁面
- **THEN** 頁面底部顯示「註冊即代表您同意我們的服務條款與隱私權政策」
- **AND** 「服務條款」和「隱私權政策」為可點擊連結
