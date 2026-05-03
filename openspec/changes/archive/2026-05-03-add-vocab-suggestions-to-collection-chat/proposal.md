## Why

新增收藏聊天目前能整理句子與語塊，但當 AI 發現句子中的主要單字不在使用者既有卡片裡時，只能用文字提醒，使用者需要離開流程再到牌組新增卡片。這會打斷「從句子/語塊延伸到單字」的學習路徑，也讓收藏包與既有單字卡之間的連結不夠順。

## What Changes

- 收藏包聊天回應可包含「建議新增單字卡」候選，與句子、搭配詞、片語、子句候選並列呈現。
- Codex agent 需先用既有單字卡 tool 判斷主要單字是否已存在；只有找不到且對理解句子或語塊有幫助時才回傳單字候選。
- 新增收藏頁顯示單字候選卡；已存在的單字卡不得再顯示新增候選。
- 使用者點擊單字候選加號後，先選擇要加入的牌組；前端記住上次選擇的牌組。
- 選定牌組後開啟既有新增快閃卡表單，預填正面、中文解釋、英文例句與中文例句翻譯。
- 成功新增卡片後，單字候選卡顯示已加入狀態，並可供後續收藏包流程連結到該卡片。
- 不自動建立單字卡；使用者按加號並完成新增快閃卡流程後才正式寫入。

## Capabilities

### New Capabilities

- `collection-chat-vocab-suggestions`: 定義收藏包聊天中建議新增單字卡、選牌組、預填新增快閃卡與狀態同步的行為。

### Modified Capabilities

- `collection-pack-backend`: 收藏包聊天 AI 回應需正式支援建議單字候選資料，並保證不自動建立卡片。
- `collection-pack-ui`: 新增收藏頁需呈現建議單字卡、牌組選擇與新增快閃卡入口。
- `card-management`: 既有新增卡片流程需支援由收藏包帶入預填資料並在成功後回到收藏包上下文。
- `deck-management`: 前端需在收藏包新增單字流程中取得可加入的牌組列表，並記住使用者上次選擇。

## Impact

- 後端：收藏包 Codex output schema、Codex prompt/tools、chat message metadata 型別、可能新增回應 DTO。
- 前端：收藏包新增頁、聊天訊息/候選卡片 domain、localStorage 偏好、牌組選擇 UI、導向或嵌入既有卡片編輯表單。
- API client：若 OpenAPI contract 新增建議單字欄位或 DTO，需要重新生成 client。
- 測試：Codex provider 單元測試、收藏包前端 domain/helper 測試、卡片新增預填流程測試。
