# collection-pack-ui Specification

## Purpose

定義收藏包前端 UI 的正式入口、列表瀏覽、句子與語塊呈現，以及聊天式新增收藏流程。收藏包 UI 使用後端 API 顯示與更新資料，並在聊天中呈現 AI 回覆與可收藏候選。

## Requirements

### Requirement: 收藏包提供正式前端入口

系統 SHALL 在已登入使用者可到達的前端路由中提供收藏包 UI，並讓使用者能從既有學習入口進入收藏包。

#### Scenario: 從首頁進入收藏包

- **WHEN** 使用者位於 `/home`
- **THEN** 系統顯示「收藏包」入口
- **AND** 入口視覺 SHALL 與 Decks、Speaking 入口一致
- **AND** 使用者點擊後進入收藏包列表頁

#### Scenario: 收藏包頁使用既有頁首語彙

- **WHEN** 使用者進入收藏包列表頁或新增收藏頁
- **THEN** 系統顯示 FlashMind 既有頁首樣式
- **AND** 頁面背景、文字、卡片與按鈕 SHALL 使用既有深色設計 token 或等價 Tailwind class

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

### Requirement: 收藏包列表支援搜尋

系統 SHALL 提供搜尋輸入，讓使用者以英文、中文或來源單字篩選收藏項目。

#### Scenario: 以英文搜尋

- **WHEN** 使用者輸入英文關鍵字
- **THEN** 系統顯示英文內容、語塊內容或來源單字符合關鍵字的項目

#### Scenario: 以中文搜尋

- **WHEN** 使用者輸入中文關鍵字
- **THEN** 系統顯示中文意思符合關鍵字的項目

#### Scenario: 清空搜尋

- **WHEN** 使用者清空搜尋輸入
- **THEN** 系統回到目前分類 tab 的完整結果

### Requirement: 收藏項目卡片呈現句子與語塊資訊

系統 SHALL 以卡片呈現收藏項目的英文內容、中文意思、類型與相關資訊。

#### Scenario: 顯示句子收藏卡

- **WHEN** 收藏項目類型為句子
- **THEN** 系統顯示英文句子與中文意思
- **AND** 系統顯示「句子」類型標籤
- **AND** 系統顯示 AI 拆解區塊

#### Scenario: 顯示搭配詞收藏卡

- **WHEN** 收藏項目類型為搭配詞
- **THEN** 系統顯示搭配詞與中文意思
- **AND** 系統顯示來源單字
- **AND** 系統可顯示關聯片語或關聯子句

#### Scenario: 顯示片語或子句收藏卡

- **WHEN** 收藏項目類型為片語或子句
- **THEN** 系統顯示英文內容與中文意思
- **AND** 系統可列出關聯搭配詞
- **AND** 系統可列出關聯句子

### Requirement: 句子收藏卡提供語塊高亮與 AI 拆解

系統 SHALL 在句子收藏卡中呈現 AI 拆解結果，並在英文句子中高亮可辨識的語塊片段。

#### Scenario: 句子包含多個搭配詞

- **WHEN** 一個句子收藏包含兩個以上搭配詞
- **THEN** 系統在 AI 拆解區塊列出所有搭配詞
- **AND** 每個搭配詞 SHALL 顯示英文內容、中文意思與類型標籤

#### Scenario: 高亮句子中的語塊

- **WHEN** AI 拆解片段出現在英文句子中
- **THEN** 系統在句子文字中高亮該片段
- **AND** 不同類型語塊 SHALL 有可辨識但不刺眼的視覺標記

#### Scenario: 拆解片段未出現在句子中

- **WHEN** AI 拆解片段無法在英文句子中找到
- **THEN** 系統仍顯示原始句子
- **AND** 系統仍在 AI 拆解區塊顯示該拆解項目

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

### Requirement: 新增收藏頁顯示建議新增單字

新增收藏頁 SHALL 在 AI 回覆下方顯示建議新增單字卡，並與可收藏句子/語塊候選清楚區分。

#### Scenario: AI 回覆包含單字候選

- **WHEN** 收藏包聊天 API 回傳 `suggestedCards`
- **THEN** 新增收藏頁 SHALL 顯示「建議新增單字」區塊
- **AND** 每張單字候選卡 SHALL 顯示正面文字
- **AND** 每張單字候選卡 SHALL 顯示中文解釋或建議原因
- **AND** 尚未加入的候選 SHALL 顯示加號按鈕

#### Scenario: AI 回覆不包含單字候選

- **WHEN** 收藏包聊天 API 回傳空的 `suggestedCards`
- **THEN** 新增收藏頁 SHALL NOT 顯示空的建議新增單字區塊

#### Scenario: 已存在的單字卡候選

- **WHEN** 單字候選代表已存在於使用者卡片中的單字
- **THEN** 新增收藏頁 SHALL 顯示已存在狀態
- **AND** 該候選 SHALL NOT 顯示新增加號

### Requirement: 單字候選加號開啟選牌組流程

新增收藏頁 SHALL 在使用者點擊單字候選加號後，讓使用者選擇要加入的牌組。

#### Scenario: 點擊單字候選加號

- **WHEN** 使用者點擊單字候選卡上的加號
- **THEN** 系統 SHALL 開啟牌組選擇 UI
- **AND** 牌組選擇 UI SHALL 顯示使用者可加入卡片的牌組

#### Scenario: 沒有任何牌組

- **WHEN** 使用者點擊單字候選加號
- **AND** 使用者沒有可用牌組
- **THEN** 系統 SHALL 顯示建立牌組或返回牌組頁的提示
- **AND** 系統不得開啟新增快閃卡表單

#### Scenario: 取消選牌組

- **WHEN** 使用者在牌組選擇 UI 點擊取消或關閉
- **THEN** 系統 SHALL 返回新增收藏聊天畫面
- **AND** 單字候選 SHALL 維持未加入狀態

### Requirement: 單字候選使用既有新增快閃卡表單

新增收藏頁 SHALL 在使用者選擇牌組後，使用既有新增快閃卡表單欄位建立卡片。

#### Scenario: 預填新增快閃卡表單

- **WHEN** 使用者選定牌組
- **THEN** 系統 SHALL 開啟新增快閃卡表單
- **AND** 正面欄位 SHALL 預填單字候選的 `front`
- **AND** 詞義區塊 SHALL 預填候選 meanings 的中文解釋、英文例句與中文例句翻譯

#### Scenario: 表單內容可編輯

- **WHEN** 新增快閃卡表單由單字候選開啟
- **THEN** 使用者 SHALL 能修改正面與所有詞義欄位
- **AND** 使用者 SHALL 能新增或刪除詞義區塊，並遵循既有最少一筆詞義限制

#### Scenario: 建立成功後返回聊天

- **WHEN** 使用者儲存新增快閃卡且 API 成功
- **THEN** 系統 SHALL 回到新增收藏聊天上下文
- **AND** 對應單字候選 SHALL 顯示已加入狀態

### Requirement: 新增快閃卡彈窗內容可滾動

若新增快閃卡表單以彈窗或底部 sheet 方式呈現，系統 SHALL 確保內容高度超出視窗時仍可操作。

#### Scenario: 表單高度超出視窗

- **WHEN** 新增快閃卡表單內容超出目前 viewport 高度
- **THEN** 表單內容 SHALL 可垂直滾動
- **AND** 儲存與取消操作 SHALL 保持可到達
