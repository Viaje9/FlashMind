## ADDED Requirements

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
