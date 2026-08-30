## ADDED Requirements

### Requirement: CLI 是獨立且不含 AI 的應用程式

專案 SHALL 在 `apps/cli` 提供 `flashmind` 指令入口，以 pnpm workspace 管理；CLI SHALL 透過 FlashMind API 存取帳號資料，不直接連 DB、不啟動 NestJS、不依賴 Angular runtime，也不要求 AI API key。

#### Scenario: 在 Agent 的工作目錄執行

- **WHEN** 已安裝或已連結 CLI 的 Agent 從任意工作目錄執行指令
- **THEN** CLI 使用自身設定找到 API，檔案參數依使用者傳入位置解析
- **AND** 不要求在 FlashMind repo 或 English Study 專案中執行

### Requirement: 第一版提供四個指令

CLI SHALL 提供 `flashmind login`、`flashmind practice context`、`flashmind review validate <file>` 與 `flashmind review save <file>`。第一版不提供 `summarize`、建立草稿、加入牌組或瀏覽器資料搬移命令。

#### Scenario: 取得 Practice 上下文

- **WHEN** 執行 `flashmind practice context`
- **THEN** stdout 輸出完整、可解析的 context JSON
- **AND** 不建立學習紀錄

#### Scenario: 驗證本機檔案

- **WHEN** 執行 `flashmind review validate draft.json`
- **THEN** CLI 讀取該檔，先檢查格式，再透過唯讀驗證 API 核對目前帳號資料
- **AND** stdout 回傳結構化驗證結果，不改檔、不上傳成持久草稿

#### Scenario: 寫回已確認檔案

- **WHEN** 執行 `flashmind review save draft.json`
- **THEN** CLI 讀取該次執行的檔案快照，重新驗證並送出保存
- **AND** 成功回傳場次 ID、Review ID、保存／重試結果與單字變更摘要
- **AND** 不在執行途中重新生成或改寫內容

### Requirement: Practice 與 Review skill 整合契約

專案 SHALL 提供可供外部 skill 採用的操作文件及有效草稿範例。Practice skill SHALL 先取 context 再對話；Review skill SHALL 以完整練習內容產生本機草稿、自動驗證後展示，修改後再次驗證，僅在明確儲存授權後呼叫 save。

#### Scenario: Review 執行完但使用者尚未要求儲存

- **WHEN** Review skill 產生並驗證草稿後展示內容
- **THEN** Agent 等待使用者 Review
- **AND** 不因 skill 結束、驗證通過或暫存檔存在而呼叫 save

#### Scenario: 格式錯誤可自行修正

- **WHEN** validate 回報 Agent 可處理的格式錯誤
- **THEN** Review skill 修正並重跑 validate，再展示通過的草稿
- **AND** 不要求使用者另外說「驗證」，但無法自行確認的對話證據不得補造

### Requirement: stdout 與錯誤碼適合 Agent 使用

非互動命令 SHALL 將單一結構化 JSON 放在 stdout；進度與人類說明放在 stderr。成功 exit code SHALL 為 0；格式、驗證、認證、衝突或網路失敗 SHALL 非 0，包含穩定錯誤碼及可判讀訊息。

#### Scenario: JSON 不合法

- **WHEN** 輸入檔不存在或 JSON 無法解析
- **THEN** CLI 回報檔案／解析錯誤且非 0 結束
- **AND** 不發出保存請求，不把整份私人對話印到錯誤日誌

#### Scenario: 網路或 session 失敗

- **WHEN** context、validate 或 save 遇到網路錯誤或 session 過期
- **THEN** CLI 回報明確的可重試錯誤或要求重新登入
- **AND** 不把失敗當成功、不刪除草稿、不自動換環境或帳號

### Requirement: 設定與私人資料分離

CLI SHALL 明確設定 API 環境，將憑證存於 repo 外且限制存取，context 與草稿不得含登入 token。只有 login 可互動要求登入；其他命令不得等待隱藏提示或默默重新登入。

#### Scenario: 使用不同 API 環境

- **WHEN** 使用者切換正式環境與開發環境
- **THEN** CLI 按 API origin 隔離登入憑證
- **AND** 草稿目標帳號／環境不符時拒絕保存，而不把私人紀錄寫入另一個環境
