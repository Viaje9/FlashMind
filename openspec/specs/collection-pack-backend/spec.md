# collection-pack-backend Specification

## Purpose

定義收藏包後端 API、資料模型、聊天 session、OpenAI Agents SDK agent 與收藏候選保存流程。收藏包後端負責保存句子、搭配詞、片語、子句及其語意關聯，並透過受控 tools 讓 AI 使用使用者既有單字卡與收藏資料。

## Requirements

### Requirement: 收藏包 API 支援列表、分類、搜尋與刪除

系統 SHALL 提供已登入使用者操作自己收藏包的後端 API，並支援以收藏類型與關鍵字查詢收藏項目。

#### Scenario: 取得收藏列表

- **WHEN** 已登入使用者請求收藏包列表
- **THEN** 系統回傳該使用者的收藏項目
- **AND** 回應 SHALL 使用既有 wrapper 格式
- **AND** 回應 SHALL 包含 cursor-based 分頁資訊

#### Scenario: 依收藏類型篩選

- **WHEN** 使用者以 `kind` 查詢句子、搭配詞、片語或子句
- **THEN** 系統只回傳該類型的收藏項目
- **AND** 系統不得回傳其他使用者的收藏項目

#### Scenario: 以關鍵字搜尋

- **WHEN** 使用者提供搜尋關鍵字
- **THEN** 系統 SHALL 以英文內容、中文意思或來源單字卡資訊篩選收藏項目
- **AND** 搜尋結果 SHALL 仍受使用者權限限制

#### Scenario: 刪除收藏項目

- **WHEN** 使用者刪除自己的收藏項目
- **THEN** 系統 SHALL 移除該收藏項目
- **AND** 系統 SHALL 一併移除該項目的關聯資料

### Requirement: 收藏項目可保存四種英文表達

系統 SHALL 以正式資料模型保存句子、搭配詞、片語與子句，並以使用者、類型與正規化文字避免重複收藏。

#### Scenario: 保存句子收藏

- **WHEN** 使用者收藏句子候選
- **THEN** 系統建立或更新該使用者的句子收藏項目
- **AND** 系統 SHALL 保存英文內容與中文意思

#### Scenario: 保存語塊收藏

- **WHEN** 使用者收藏搭配詞、片語或子句候選
- **THEN** 系統建立或更新對應類型的收藏項目
- **AND** 系統 SHALL 使用後端產生的正規化文字進行去重

#### Scenario: 重複收藏同一內容

- **WHEN** 使用者再次收藏相同類型與相同正規化文字的項目
- **THEN** 系統 SHALL 回傳既有收藏項目
- **AND** 系統不得建立重複資料

### Requirement: 收藏項目可保存彼此語意關聯

系統 SHALL 保存收藏項目之間的語意關聯，用來表示句子、搭配詞、片語與子句之間的包含或衍生關係。

#### Scenario: 句子關聯多個語塊

- **WHEN** 使用者保存包含多個語塊的句子候選
- **THEN** 系統 SHALL 保存句子與每個搭配詞、片語或子句的關聯
- **AND** 關聯 SHALL 保留排序資訊

#### Scenario: 片語或子句關聯搭配詞

- **WHEN** 使用者保存片語或子句候選，且候選包含關聯搭配詞
- **THEN** 系統 SHALL 保存片語或子句與搭配詞的關聯

#### Scenario: 後端不保存高亮位置

- **WHEN** 系統保存收藏項目關聯
- **THEN** 系統 SHALL 只保存語意關聯
- **AND** 系統不得要求資料庫保存字元起訖位置或 UI 高亮位置

### Requirement: 收藏項目可連結既有單字卡

系統 SHALL 支援收藏項目連結到使用者既有單字卡，以表示該句子或語塊由哪些已學單字延伸而來。

#### Scenario: 收藏搭配詞時連結來源單字卡

- **WHEN** 使用者收藏由既有單字卡延伸出的搭配詞
- **THEN** 系統 SHALL 建立收藏項目與該單字卡的連結
- **AND** 連結 SHALL 只允許指向同一使用者可存取的卡片

#### Scenario: AI 建議新單字卡

- **WHEN** AI 候選包含使用者尚未建立的單字
- **THEN** 系統 SHALL 在聊天回應中回傳建議單字資訊
- **AND** 系統不得在本次流程自動建立新的單字卡

### Requirement: 收藏包聊天保存多輪 session 與訊息

系統 SHALL 保存收藏包聊天 session、使用者訊息、AI 回覆與 OpenAI Agents provider thread id，以支援多輪對話與 thread resume。

#### Scenario: 建立聊天 session

- **WHEN** 使用者開啟新的收藏包聊天
- **THEN** 系統 SHALL 建立聊天 session
- **AND** session SHALL 屬於目前登入使用者

#### Scenario: 送出聊天訊息

- **WHEN** 使用者在收藏包聊天 session 送出訊息
- **THEN** 系統 SHALL 保存使用者訊息
- **AND** 系統 SHALL 透過 OpenAI Agents provider 產生 AI 回覆
- **AND** 系統 SHALL 保存 AI 回覆與結構化 metadata

#### Scenario: Resume Agents SDK conversation

- **WHEN** 聊天 session 已有 provider thread id
- **THEN** 系統 SHALL 使用既有 provider thread 繼續對話
- **AND** 系統不得為同一 session 每次重建新的 provider thread

### Requirement: OpenAI Agents SDK agent 可依意圖回覆或產生收藏候選

系統 SHALL 使用 OpenAI Agents SDK agent 判斷使用者意圖，並依意圖回傳翻譯、修正、解釋、搜尋結果或可收藏候選。

#### Scenario: 明確翻譯不回收藏候選

- **WHEN** 使用者明確要求翻譯
- **THEN** 系統 SHALL 回傳自然翻譯
- **AND** 回應中的收藏候選 SHALL 為空

#### Scenario: 明確修正或改寫不主動回收藏候選

- **WHEN** 使用者明確要求修正、改寫或確認自然度
- **THEN** 系統 SHALL 回傳修正或改寫結果
- **AND** 系統不得主動產生收藏候選

#### Scenario: 搜尋既有收藏

- **WHEN** 使用者要求尋找已收藏的句子或語塊
- **THEN** OpenAI Agents SDK agent SHALL 使用收藏搜尋 tool
- **AND** 系統 SHALL 回傳符合條件的既有收藏項目

#### Scenario: 用已學單字產生候選

- **WHEN** 使用者要求練習、收藏、拆語塊或用已學單字延伸
- **THEN** OpenAI Agents SDK agent SHALL 可使用單字卡查詢 tool 與收藏搜尋 tool
- **AND** 系統 SHALL 回傳可收藏的句子或語塊候選

#### Scenario: 裸句子 fallback

- **WHEN** 使用者只輸入一句話且沒有明確翻譯、修正、解釋或搜尋意圖
- **THEN** 系統 SHALL 將該輸入視為裸句子分析
- **AND** 系統 SHALL 回傳自然英文或中文理解結果
- **AND** 系統 SHALL 回傳可收藏的句子或語塊候選

### Requirement: OpenAI Agents SDK agent 透過 tools 查詢使用者資料

系統 SHALL 讓 OpenAI Agents SDK agent 透過受控後端 tools 查詢使用者單字卡與收藏包資料，而不是直接存取資料庫。

#### Scenario: 查詢使用者單字摘要

- **WHEN** OpenAI Agents SDK agent 需要使用者已學單字上下文
- **THEN** 系統 SHALL 透過 tool 回傳該使用者可存取的單字卡摘要

#### Scenario: 搜尋使用者單字卡

- **WHEN** OpenAI Agents SDK agent 需要確認特定文字是否存在於使用者單字卡
- **THEN** 系統 SHALL 透過 tool 搜尋 `Card.front` 與 `CardMeaning.zhMeaning`

#### Scenario: 搜尋既有收藏避免重複

- **WHEN** OpenAI Agents SDK agent 產生收藏建議前需要比對既有收藏
- **THEN** 系統 SHALL 透過 tool 搜尋使用者收藏項目
- **AND** 系統 SHALL 在回應中標示候選是否已存在

### Requirement: 使用者確認後一次保存候選與關聯

系統 SHALL 在使用者按加號確認收藏候選後，保存候選本體、關聯語塊與來源卡片連結。

#### Scenario: 保存句子候選與拆解關聯

- **WHEN** 使用者確認收藏句子候選
- **THEN** 系統 SHALL upsert 句子收藏項目
- **AND** 系統 SHALL upsert 候選中的關聯搭配詞、片語與子句
- **AND** 系統 SHALL 建立句子與語塊之間的關聯

#### Scenario: 保存語塊候選與來源卡片

- **WHEN** 使用者確認收藏搭配詞、片語或子句候選
- **THEN** 系統 SHALL upsert 對應收藏項目
- **AND** 系統 SHALL 建立該項目與來源單字卡的連結

#### Scenario: 拒絕保存其他使用者資料

- **WHEN** 收藏候選要求連結不存在或不可存取的卡片
- **THEN** 系統 SHALL 忽略該卡片連結或回傳驗證錯誤
- **AND** 系統不得建立跨使用者資料關聯

### Requirement: OpenAI API key 錯誤可被產品化處理

系統 SHALL 將 OpenAI Agents SDK 本機 OAuth 或執行錯誤映射為 API 可理解的錯誤格式。

#### Scenario: OpenAI API key 尚未設定

- **WHEN** OpenAI Agents SDK 因未登入或 OAuth 失效而無法執行
- **THEN** 系統 SHALL 回傳錯誤碼表示 OpenAI API key 需要設定
- **AND** 錯誤訊息 SHALL 指引使用者或開發者執行 `設定 OPENAI_API_KEY`

#### Scenario: OpenAI Agents SDK 執行逾時或失敗

- **WHEN** OpenAI Agents SDK 呼叫逾時或回傳不可恢復錯誤
- **THEN** 系統 SHALL 回傳既有 error wrapper 格式
- **AND** 系統不得洩漏未清洗的底層錯誤內容給前端

### Requirement: 收藏包聊天回應可包含建議單字卡候選

收藏包後端 SHALL 在聊天訊息 API 回應中支援建議單字卡候選，並讓候選資料可直接預填既有新增快閃卡表單。

#### Scenario: 回傳建議單字卡

- **WHEN** OpenAI Agents SDK agent 判斷使用者輸入需要補充尚未建立的主要單字
- **THEN** `CollectionChatMessageResult.suggestedCards` SHALL 包含該單字候選
- **AND** 每筆候選 SHALL 包含 `front`
- **AND** 每筆候選 SHALL 包含至少一筆 `meanings`
- **AND** 每筆 `meaning` SHALL 支援 `zhMeaning`、`enExample`、`zhExample`

#### Scenario: 單字候選可說明建議原因

- **WHEN** 後端回傳單字卡候選
- **THEN** 候選 SHALL 可包含建議原因
- **AND** 前端 SHALL 能以該原因說明為什麼這個單字值得新增

#### Scenario: 不自動建立單字卡

- **WHEN** 聊天 API 回傳 `suggestedCards`
- **THEN** 後端 SHALL NOT 建立 Card
- **AND** 後端 SHALL NOT 建立 CardMeaning
- **AND** 後端 SHALL NOT 修改任何牌組卡片數量

### Requirement: OpenAI Agents SDK agent 不得建議已存在的單字卡

OpenAI Agents SDK agent SHALL 使用後端提供的單字卡搜尋結果判斷單字是否已存在，避免回傳重複的新增單字候選。

#### Scenario: 找到既有單字卡

- **WHEN** `searchUserCards` 或相關單字卡摘要中已存在候選單字
- **THEN** OpenAI Agents SDK agent SHALL NOT 將該單字放入 `suggestedCards`
- **AND** 若該單字與句子或語塊候選相關，系統 SHALL 使用既有卡片 id 作為 `sourceCardIds`

#### Scenario: 找不到既有單字卡

- **WHEN** 主要單字無法對應到使用者可存取的卡片
- **AND** 該單字有助於使用者理解或收藏本次句子/語塊
- **THEN** OpenAI Agents SDK agent MAY 將該單字放入 `suggestedCards`
- **AND** 候選不得包含捏造的既有 card id

#### Scenario: 單純翻譯不回傳單字候選

- **WHEN** 使用者明確要求只翻譯或不要卡片
- **THEN** 後端回應中的 `suggestedCards` SHALL 為空陣列
- **AND** 後端回應中的收藏候選 SHALL 為空陣列

### Requirement: 聊天 metadata 保存單字候選

收藏包後端 SHALL 保存 AI 回覆中的單字候選 metadata，讓重新載入聊天 session 時可重建 UI 狀態。

#### Scenario: 保存 AI 訊息

- **WHEN** 後端保存 assistant 聊天訊息
- **THEN** 訊息 metadata SHALL 包含本輪 `suggestedCards`
- **AND** metadata SHALL 使用可序列化 JSON

#### Scenario: 重新載入聊天訊息

- **WHEN** 前端重新取得收藏包聊天訊息
- **THEN** 系統 SHALL 回傳先前 assistant 訊息中的單字候選
- **AND** 前端 SHALL 能重新呈現單字候選卡
