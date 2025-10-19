## 核心原則

### I. 雲端同步優先（Cloud-Sync-First）

應用核心功能必須依賴穩定的雲端同步，確保不同裝置間進度一致。
在離線時可暫存資料於 LocalStorage，待連線恢復後自動同步。
同步衝突以「最後寫入勝」為預設策略，必要時提供事件日誌追溯。

### II. FSRS 排程一致性（FSRS Scheduling Integrity）

複習排程必須遵循 FSRS 模型（固定參數與狀態轉移規範）。
任何演算法或參數更新必須附上遷移腳本與回歸測試。
同一測資在不同版本下應產生可重現的複習時間。

### III. 嚴格資料契約（Strict Data Contract）

所有資料結構（卡片、牌組、學習紀錄）必須以 JSON Schema 或 Prisma Schema 定義。
Schema 必須包含 `version` 欄位，破壞性變更需伴隨遷移與測試。
後端 API 介面以 OpenAPI 為單一真實來源（source of truth）。

### IV. 測試優先（Test-Driven Development）

所有新功能必須以測試驅動開發（TDD）方式實作。
在 CI 階段執行單元測試、契約測試與 E2E 測試。
未通過測試的變更不得合併主分支。

### V. 錯誤提示與可除錯性（User-Facing Diagnostics）

應用需提供明確且具體的錯誤提示，以利除錯與使用者理解。
不強制要求完整觀測系統，但需保留可追蹤錯誤代碼與訊息。

### VI. 簡單性優先（Simplicity First）

MUST 保持架構與功能的最小化，避免過度抽象與不必要的依賴。
SHOULD 優先以直覺方式實作，確保新成員可快速理解。
所有功能均需符合「能在一個開發週期內交付」的原則。

### VII. 契約驅動開發（Contract-Driven Development）

前後端溝通、測試與 API 檢查必須依據同一份 OpenAPI 定義。
任何 API 變更需更新 schema 並通過契約測試。
前端型別可自動從 OpenAPI 生成，避免重複定義。

### VIII. UI 一致性原則（UI Consistency via Storybook）

所有可重用元件必須維護於 Storybook，且具備至少一個示例狀態。
Tailwind 用於確保樣式一致性與主題統一。
UI 修改需同步更新 Storybook 展示範例與快照測試。

---

## 技術堆疊與開發流程

**前端**：Angular + Tailwind CSS + LocalStorage + Storybook
**後端**：NestJS + OpenAPI + Prisma
**資料庫**：PostgreSQL

### 架構原則

* 採前後端分離設計。
* LocalStorage 作為暫存層，支援離線使用。
* 雲端 API 負責同步與備份；不得依賴伺服器狀態進行排程。

### 開發流程

1. 功能開發遵循 TDD（先測試、後實作）。
2. 所有 schema 變更須執行 migration 並通過測試。
3. UI 元件調整需同步更新 Storybook。
4. 提交前自動執行靜態分析、單元與契約測試。
