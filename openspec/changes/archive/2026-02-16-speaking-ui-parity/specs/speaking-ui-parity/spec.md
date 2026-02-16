## ADDED Requirements

### Requirement: Speaking 主頁互動需與舊版流程等價

系統 SHALL 在 `/speaking` 提供與 SpeakUpEnglish 等價的主流程互動，包括中心麥克風、錄音狀態切換與送出節奏。

#### Scenario: 待機狀態顯示中心麥克風與輔助操作

- **WHEN** 使用者進入 `/speaking` 且尚未開始錄音
- **THEN** 系統顯示中心麥克風主按鈕
- **AND** 顯示 AI 助手開關與新對話/摘要等輔助操作

#### Scenario: 錄音中切換暫停與停止

- **WHEN** 使用者開始錄音
- **THEN** 系統顯示錄音中狀態（含時間計時與動態回饋）
- **AND** 使用者可執行暫停、繼續、停止、取消

#### Scenario: 送出失敗可重試最後錄音

- **WHEN** 錄音送出後請求失敗
- **THEN** 系統保留最後一次錄音 payload
- **AND** 提供「重試送出」互動入口

### Requirement: Speaking 訊息視圖需保留語音對話語意

系統 SHALL 以語音對話為核心呈現 user/assistant 訊息，並提供翻譯與播放狀態回饋。

#### Scenario: User 訊息以語音訊息樣式呈現

- **WHEN** 訊息角色為 user 且包含語音資料
- **THEN** 系統以語音訊息樣式顯示
- **AND** 提供播放控制

#### Scenario: Assistant 訊息顯示播放狀態與翻譯切換

- **WHEN** 訊息角色為 assistant
- **THEN** 系統顯示播放入口與播放中狀態回饋
- **AND** 使用者可切換翻譯顯示/原文

#### Scenario: 摘要訊息以獨立語意區塊呈現

- **WHEN** 訊息角色為 summary
- **THEN** 系統以獨立摘要樣式顯示
- **AND** 提供複製摘要能力

### Requirement: Speaking 主頁需提供情境化錯誤提示

系統 SHALL 依失敗原因提供可行的操作建議，而非僅顯示通用錯誤訊息。

#### Scenario: 麥克風權限或安全上下文不符

- **WHEN** 裝置無麥克風權限或非安全上下文
- **THEN** 系統顯示阻擋提示
- **AND** 提供具體修正建議（HTTPS、權限設定）

#### Scenario: 請求大小超限

- **WHEN** 語音送出觸發 payload 大小限制
- **THEN** 系統提示錄音過長或請求過大
- **AND** 建議縮短錄音或開始新對話

### Requirement: AI 助手與筆記面板需可疊加於 speaking 流程

系統 SHALL 在 speaking 主流程中支援可開關的 AI 助手與筆記浮動面板，且不阻斷錄音流程。

#### Scenario: AI 助手面板可開關與清空歷史

- **WHEN** 使用者開啟 AI 助手
- **THEN** 系統顯示獨立對話面板
- **AND** 使用者可送訊息、查看回覆、清空歷史

#### Scenario: 浮動筆記面板可拖曳與調整高度

- **WHEN** 使用者開啟筆記面板
- **THEN** 面板可拖曳位置並調整高度
- **AND** 系統保存使用者的面板位置與尺寸設定

### Requirement: Speaking 歷史頁需支援詳情與續聊

系統 SHALL 提供歷史列表與詳情視圖，讓使用者可回看、刪除或繼續既有對話。

#### Scenario: 歷史列表顯示對話摘要資訊

- **WHEN** 使用者進入 `/speaking/history`
- **THEN** 系統顯示每筆對話的時間、標題/摘要、訊息數

#### Scenario: 歷史詳情可繼續對話

- **WHEN** 使用者打開歷史詳情
- **THEN** 系統顯示該對話訊息
- **AND** 使用者可回到 `/speaking` 繼續對話

#### Scenario: 刪除需顯示確認

- **WHEN** 使用者嘗試刪除歷史對話
- **THEN** 系統顯示刪除確認互動
- **AND** 確認後才刪除資料

### Requirement: Speaking 設定頁需支援草稿與未儲存保護

系統 SHALL 在 `/settings/speaking` 以草稿模式編輯設定，並在離開時保護未儲存變更。

#### Scenario: 離開設定頁時檢查未儲存變更

- **WHEN** 使用者修改設定後嘗試返回
- **THEN** 系統顯示「放棄未儲存變更」確認
- **AND** 使用者可選擇取消或放棄離開

#### Scenario: 支援重設與儲存

- **WHEN** 使用者點擊重設設定
- **THEN** 系統恢復預設值至草稿內容
- **AND** 只有在使用者儲存後才寫入正式設定
