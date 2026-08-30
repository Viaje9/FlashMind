# card-notes Specification

## Purpose

定義卡片備註在底層卡片資料、編輯頁、學習浮窗、自動儲存、AI 浮窗並存及牌組匯入匯出流程中的保存規則。

## Requirements

### Requirement: 卡片備註持久化

系統 SHALL 讓每張底層卡片保存一份可為空的純文字備註，且讀取卡片詳情與學習卡片時 SHALL 回傳該備註。

#### Scenario: 建立含備註的卡片

- **WHEN** 使用者建立卡片並提供備註
- **THEN** 系統 SHALL 將備註與卡片一起保存並在卡片詳情回傳

#### Scenario: 部分更新備註

- **WHEN** 使用者只送出卡片的 `note` 更新
- **THEN** 系統 SHALL 更新備註且不得替換或刪除既有詞義

#### Scenario: 清除備註

- **WHEN** 使用者將 `note` 更新為空字串或 null
- **THEN** 系統 SHALL 將卡片備註清除並回傳 null

#### Scenario: 正反向共用備註

- **WHEN** 同一張底層卡片產生正向與反向 StudyCard
- **THEN** 兩個 StudyCard SHALL 回傳相同的卡片備註

### Requirement: 卡片編輯頁維護備註

系統 SHALL 在新增與編輯卡片頁提供純文字備註欄位，並與卡片其他內容一起保存。

#### Scenario: 從牌組查看既有備註

- **WHEN** 使用者從牌組開啟一張已有備註的卡片
- **THEN** 卡片編輯頁 SHALL 顯示該備註且允許修改

#### Scenario: 新增卡片時填寫備註

- **WHEN** 使用者新增卡片並填寫備註後儲存
- **THEN** 再次開啟該卡片時 SHALL 顯示相同備註

### Requirement: 翻卡後使用備註浮窗

系統 SHALL 只在卡片翻開後提供卡片備註入口，並以獨立浮窗編輯目前卡片的備註。

#### Scenario: 尚未翻卡

- **WHEN** 學習卡片仍顯示正面
- **THEN** 系統 SHALL 不顯示備註入口或備註內容

#### Scenario: 翻開卡片並開啟備註

- **WHEN** 使用者翻開卡片並點擊備註按鈕
- **THEN** 系統 SHALL 開啟顯示目前卡片備註的純文字浮窗

#### Scenario: 切換下一張卡片

- **WHEN** 使用者評分並切換到下一張卡片
- **THEN** 備註浮窗 SHALL 關閉且不得顯示上一張卡片的內容

### Requirement: 備註與 AI 浮窗可同時操作

系統 SHALL 允許卡片備註與卡片 AI 助手同時開啟，且兩者 SHALL 可獨立關閉、垂直拖曳與調整高度。

#### Scenario: 同時展開兩個浮窗

- **WHEN** 使用者已開啟 AI 助手並再開啟卡片備註
- **THEN** 兩個浮窗 SHALL 同時存在且任一視窗的關閉操作不得關閉另一個

#### Scenario: 記憶備註版面

- **WHEN** 使用者移動或調整備註浮窗高度後重新開啟
- **THEN** 系統 SHALL 還原上次的 top 與 height 並限制在目前 viewport 與安全區內

### Requirement: 學習備註自動儲存

系統 SHALL 在使用者停止輸入約 600ms 後自動儲存備註，並顯示儲存中、已儲存或儲存失敗狀態。

#### Scenario: 延遲儲存成功

- **WHEN** 使用者修改備註並停止輸入達 debounce 時間
- **THEN** 系統 SHALL 只更新目前卡片的 `note` 並顯示已儲存

#### Scenario: 關閉前仍有待儲存內容

- **WHEN** 使用者在 debounce 完成前關閉浮窗或切換卡片
- **THEN** 系統 SHALL 立即嘗試儲存最新草稿

#### Scenario: 儲存失敗

- **WHEN** 備註更新 API 回傳錯誤
- **THEN** 系統 SHALL 保留草稿、顯示儲存失敗並允許再次嘗試

### Requirement: 匯入匯出保留備註

系統 SHALL 在牌組匯入與匯出中支援 optional `note` 欄位，且不得破壞不含該欄位的既有資料格式。

#### Scenario: 匯出含備註的牌組

- **WHEN** 使用者匯出包含卡片備註的牌組
- **THEN** 匯出資料中的對應卡片 SHALL 包含該備註

#### Scenario: 匯入含備註的牌組

- **WHEN** 使用者匯入 optional `note` 有值的卡片
- **THEN** 系統 SHALL 將備註保存至新卡片

#### Scenario: 匯入舊版資料

- **WHEN** 使用者匯入不含 `note` 的既有格式
- **THEN** 系統 SHALL 正常建立卡片且備註為 null
