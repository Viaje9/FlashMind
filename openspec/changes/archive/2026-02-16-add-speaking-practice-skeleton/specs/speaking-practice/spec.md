## ADDED Requirements

### Requirement: 口說練習入口

系統 SHALL 提供口說練習入口，讓已登入使用者可從首頁進入 speaking 練習流程。

#### Scenario: 已登入使用者從 Home 進入 speaking

- **WHEN** 使用者已登入並造訪 `/home`
- **THEN** 系統顯示口說練習入口卡片
- **AND** 點擊後導向 `/speaking`

### Requirement: 口說對話 API（文字骨架）

系統 SHALL 提供 `POST /speaking/chat` 端點，接受文字訊息與歷史上下文，回傳 assistant reply。

#### Scenario: 對話成功回覆

- **WHEN** 已登入白名單使用者呼叫 `POST /speaking/chat` 並提供有效 `message`
- **THEN** 系統回傳 `200` 與 `{ data: { reply, model, usage } }`

#### Scenario: 未登入拒絕

- **WHEN** 未登入使用者呼叫 `POST /speaking/chat`
- **THEN** 系統回傳 `401 Unauthorized`

#### Scenario: 非白名單拒絕

- **WHEN** 白名單機制啟用且使用者不在允許清單內
- **THEN** 系統回傳 `403` 與 `WHITELIST_DENIED`

#### Scenario: 請求驗證失敗

- **WHEN** `message` 為空字串或格式不合法
- **THEN** 系統回傳 `400 Bad Request`

### Requirement: 口說歷史本機保存

系統 SHALL 將 speaking 對話歷史存於前端 IndexedDB，供使用者在歷史頁面載入與刪除。

#### Scenario: 對話成功後寫入本機歷史

- **WHEN** 使用者在 `/speaking` 成功收到 assistant 回覆
- **THEN** 系統將該回合訊息寫入 IndexedDB conversation/message stores

#### Scenario: 讀取與刪除歷史

- **WHEN** 使用者造訪 `/speaking/history`
- **THEN** 系統可列出可用會話
- **AND** 使用者可載入會話內容或刪除會話

### Requirement: 口說設定路徑規範

系統 SHALL 使用 `/settings/speaking` 作為口說設定唯一管理路徑。

#### Scenario: 口說設定導向 canonical 路徑

- **WHEN** 使用者從 speaking 功能進入設定
- **THEN** 系統導向 `/settings/speaking`

#### Scenario: speaking 功能不提供 `/speaking/settings`

- **WHEN** 口說功能路由被建立
- **THEN** 系統不新增 `/speaking/settings` 路由
