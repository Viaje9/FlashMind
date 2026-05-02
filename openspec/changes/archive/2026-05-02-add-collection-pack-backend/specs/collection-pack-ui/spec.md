## ADDED Requirements

### Requirement: 收藏包 UI 串接後端資料

收藏包 UI SHALL 使用收藏包後端 API 顯示與更新資料，並在 API 請求期間提供清楚的 loading、empty 與 error 狀態。

#### Scenario: 列表頁載入後端收藏項目

- **WHEN** 使用者進入收藏包列表頁
- **THEN** 系統 SHALL 呼叫收藏包列表 API
- **AND** 系統 SHALL 使用 API 回傳資料呈現收藏項目

#### Scenario: 新增收藏頁送出聊天訊息

- **WHEN** 使用者在新增收藏頁送出訊息
- **THEN** 系統 SHALL 呼叫收藏包聊天訊息 API
- **AND** 系統 SHALL 顯示 API 回傳的 AI 回覆與候選資料

#### Scenario: API 請求失敗

- **WHEN** 收藏包 API 請求失敗
- **THEN** 系統 SHALL 顯示可理解的錯誤狀態
- **AND** 頁面 SHALL 保留主要導覽與重試入口

## MODIFIED Requirements

### Requirement: 收藏包列表支援分類瀏覽

系統 SHALL 在收藏包列表頁顯示收藏項目，並支援以全部、句子、搭配詞、片語、子句切換顯示範圍。

#### Scenario: 預設顯示全部收藏

- **WHEN** 使用者進入收藏包列表頁
- **THEN** 系統預設選取「全部」分類
- **AND** 系統顯示後端 API 回傳的收藏項目列表
- **AND** 系統顯示目前可見項目數

#### Scenario: 切換分類 tab

- **WHEN** 使用者點擊「搭配詞」、「片語」、「子句」或「句子」分類
- **THEN** 系統只顯示該類型的收藏項目
- **AND** active tab SHALL 使用清楚可辨識的 selected 樣式
- **AND** 可見項目數 SHALL 隨分類結果更新

#### Scenario: 分類無結果

- **WHEN** 使用者選取的分類或搜尋條件沒有符合項目
- **THEN** 系統顯示空狀態
- **AND** 空狀態 SHALL 不破壞頁面高度與主要操作入口

### Requirement: 新增收藏頁採聊天式 UI

系統 SHALL 提供聊天式新增收藏頁，讓使用者輸入中英文內容並看到 AI 回覆，以及在適用意圖下看到可收藏的句子或語塊候選。

#### Scenario: 顯示初始聊天內容

- **WHEN** 使用者進入新增收藏頁
- **THEN** 系統 SHALL 建立或載入收藏包聊天 session
- **AND** 系統 SHALL 顯示該 session 的聊天內容

#### Scenario: 輸入內容固定在底部

- **WHEN** 使用者瀏覽新增收藏頁
- **THEN** 系統在底部顯示輸入區與送出按鈕
- **AND** 底部輸入區不得遮擋最後一組聊天訊息或建議卡片

#### Scenario: 送出文字後產生 AI 回覆

- **WHEN** 使用者輸入文字並點擊送出
- **THEN** 系統將使用者輸入送到收藏包聊天 API
- **AND** 系統顯示 API 回傳的 AI 回覆
- **AND** 若回應包含候選，系統顯示候選卡片

#### Scenario: 明確翻譯不顯示收藏候選

- **WHEN** API 回應 intent 為 `TRANSLATE_ONLY`
- **THEN** 系統 SHALL 顯示翻譯回覆
- **AND** 系統不得顯示收藏候選卡片

### Requirement: AI 建議卡片可模擬加入與移除

系統 SHALL 讓使用者在新增收藏頁對尚未收藏的建議卡片執行加入或移除操作，並與後端收藏 API 同步狀態。

#### Scenario: 加入尚未收藏的建議

- **WHEN** 建議卡片尚未存在於收藏包
- **THEN** 系統顯示加入按鈕
- **AND** 使用者點擊加入後，系統 SHALL 呼叫建立收藏 API
- **AND** 建立成功後卡片狀態改為已加入

#### Scenario: 已收藏建議不顯示加入按鈕

- **WHEN** 建議卡片代表已存在於收藏包的項目
- **THEN** 系統不顯示加入按鈕
- **AND** 系統顯示已在收藏包的狀態標籤

#### Scenario: 移除剛加入的建議

- **WHEN** 使用者點擊已加入建議卡片上的移除按鈕
- **THEN** 系統 SHALL 呼叫刪除收藏 API 或還原本次加入狀態
- **AND** 成功後卡片狀態改回可加入

## REMOVED Requirements

### Requirement: 收藏包 UI 不依賴後端功能

**Reason**: 收藏包已從純前端 prototype 進入正式後端串接階段，UI 必須使用後端 API 顯示收藏項目與 AI 聊天結果。

**Migration**: 使用「收藏包 UI 串接後端資料」取代此需求；開發與測試環境可透過 API mock 或測試替身處理後端不可用情境。
