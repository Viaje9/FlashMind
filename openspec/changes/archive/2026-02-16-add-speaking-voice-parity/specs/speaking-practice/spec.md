## ADDED Requirements

### Requirement: 純麥克風口說入口

系統 SHALL 提供純麥克風口說流程，已登入使用者可從首頁進入 `/speaking` 並完成語音練習。

#### Scenario: 已登入使用者可從 Home 進入 speaking

- **WHEN** 使用者已登入並造訪 `/home`
- **THEN** 系統顯示 Speaking 卡片
- **AND** 點擊後導向 `/speaking`

#### Scenario: speaking 主流程不提供文字輸入

- **WHEN** 使用者進入 `/speaking`
- **THEN** 系統提供錄音控制（開始、暫停、繼續、停止、取消、送出）
- **AND** 不提供主流程文字輸入框

### Requirement: 語音對話 API

系統 SHALL 提供 `POST /speaking/chat/audio`，接受錄音檔與歷史，回傳 transcript 與語音回覆。

#### Scenario: 上傳錄音成功回覆 transcript 與 audio

- **WHEN** 已登入白名單使用者呼叫 `POST /speaking/chat/audio`
- **AND** 上傳 `audioFile` 與有效 payload
- **THEN** 系統回傳 `200` 與 `{ data: { transcript, audioBase64, model, usage, memoryUpdate? } }`

#### Scenario: 未登入拒絕

- **WHEN** 未登入使用者呼叫 `POST /speaking/chat/audio`
- **THEN** 系統回傳 `401 Unauthorized`

#### Scenario: 非白名單拒絕

- **WHEN** 白名單機制啟用且使用者不在允許清單
- **THEN** 系統回傳 `403` 與對應錯誤碼

#### Scenario: 請求驗證失敗

- **WHEN** 缺少 `audioFile`、`history` JSON 格式錯誤或 voice 非法
- **THEN** 系統回傳 `400 Bad Request`
- **AND** 錯誤格式符合 ADR-016

### Requirement: 口說延伸端點

系統 SHALL 提供 summarize / translate / assistant / voice preview 端點供 speaking 模組使用。

#### Scenario: 摘要成功

- **WHEN** 呼叫 `POST /speaking/summarize` 並提供歷史
- **THEN** 系統回傳 `{ data: { title, summary, usage } }`

#### Scenario: 翻譯成功

- **WHEN** 呼叫 `POST /speaking/translate` 並提供英文文字
- **THEN** 系統回傳 `{ data: { translatedText } }`

#### Scenario: 助手對話成功

- **WHEN** 呼叫 `POST /speaking/assistant/chat`
- **THEN** 系統回傳 `{ data: { reply, model, usage } }`

#### Scenario: 聲音試聽成功

- **WHEN** 呼叫 `POST /speaking/voice-preview`
- **THEN** 系統回傳 `{ data: { audioBase64 } }`

### Requirement: 口說歷史本機保存與容量治理

系統 SHALL 在前端 IndexedDB 保存對話與音訊，並在超過容量上限時淘汰最舊會話。

#### Scenario: 對話成功後寫入 conversations/messages/audio stores

- **WHEN** 使用者送出錄音且取得 AI 回覆
- **THEN** 系統將 conversation、messages、audio 分離保存

#### Scenario: 容量超限時淘汰最舊會話

- **WHEN** IndexedDB 音訊容量超過 200MB 上限
- **THEN** 系統按 `updatedAt` 由舊到新淘汰會話
- **AND** 刪除該會話關聯訊息與音檔

#### Scenario: 可於歷史頁讀取、載入與刪除

- **WHEN** 使用者造訪 `/speaking/history`
- **THEN** 系統可列出歷史、載入對話、刪除會話

### Requirement: 設定路徑規範

系統 SHALL 以 `/settings/speaking` 作為口說設定唯一入口。

#### Scenario: 口說設定由 canonical 路徑管理

- **WHEN** 使用者從 speaking 導向設定
- **THEN** 系統導向 `/settings/speaking`

#### Scenario: `/speaking/settings` 非本功能路由

- **WHEN** speaking 路由被註冊
- **THEN** 系統不建立 `/speaking/settings`
