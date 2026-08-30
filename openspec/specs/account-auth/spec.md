# account-auth Specification

## Purpose

TBD - created by archiving change add-account-auth. Update Purpose after archive.

## Requirements

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

---

### Requirement: CLI 透過瀏覽器授權取得自身 session

系統 SHALL 允許 `flashmind login` 開啟同一 FlashMind 環境的瀏覽器登入／授權頁，使用者可沿用既有 Email 或 Google 登入。使用者確認帳號及授權後，CLI SHALL 取得自身可到期、可撤銷的 session，不複製瀏覽器 cookie、不要求提供密碼給 Agent，也不建立新帳號驗證體系。

#### Scenario: 使用者完成授權

- **WHEN** 使用者在瀏覽器登入並核對帳號、環境與本次 CLI 授權
- **THEN** 只有發起該授權的 CLI 可取得對應帳號的新 session
- **AND** CLI 保存憑證並顯示登入帳號，不在 stdout 或 URL 顯示 session token
- **AND** 此授權不代表允許 skill 自動保存 Review

#### Scenario: 取消或逾時

- **WHEN** 使用者拒絕授權或登入流程逾時
- **THEN** CLI 回報未登入成功，不留下可用的新憑證
- **AND** 不影響瀏覽器原有 session

### Requirement: CLI 授權交換必須限時且單次有效

授權流程 SHALL 綁定發起端的私密驗證材料，公開授權識別不得單獨兌換 session；兌換須限時、單次、原子處理，授權確認必須驗證瀏覽器帳號、來源與跨站請求保護。系統 SHALL 限制建立及查詢授權的頻率。

#### Scenario: 他人只取得公開授權連結

- **WHEN** 請求端只有授權頁連結，沒有發起端私密材料
- **THEN** 系統不得向該請求端回傳 CLI session

#### Scenario: 重複兌換或授權已過期

- **WHEN** 已使用或過期的授權再次被兌換
- **THEN** 系統拒絕兌換，不發出第二個 session

### Requirement: CLI 憑證沿用帳號與權限限制

CLI 的受保護操作 SHALL 使用與 App 相同的 session 驗證、有效期限、白名單與擁有者檢查。憑證 MUST 不出現在草稿、context、版本控制、錯誤日誌或 shell 指令參數中。

#### Scenario: CLI session 過期或撤銷

- **WHEN** CLI 以失效 session 存取受保護 API
- **THEN** 回傳 401，CLI 要求再次執行 login
- **AND** 原草稿保留，學習資料不變

#### Scenario: 帳號不在白名單

- **WHEN** 白名單啟用且目前帳號不符合條件
- **THEN** CLI 的 context、validate 與 save 都被拒絕
- **AND** 不因使用 CLI 而繞過 App 的限制
