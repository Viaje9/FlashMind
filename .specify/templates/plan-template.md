# 實作計畫：[FEATURE]

**分支**：`[###-feature-name]` | **日期**：[DATE] | **規格文件**：[link]  
**輸入**：`/specs/[###-feature-name]/spec.md` 中的功能規格

**備註**：此模板由 `/speckit.plan` 指令產出。執行流程請參考 `.specify/templates/commands/plan.md`。

## 摘要

[擷取自功能規格：核心需求與研究結論中的技術方案]

## 技術背景

<!--
  需替換本段內容為專案實際技術細節。
  以下結構僅作為撰寫指引。
-->

**語言／版本**：[例如：Python 3.11、Swift 5.9、Rust 1.75 或待釐清]  
**主要依賴**：[例如：FastAPI、UIKit、LLVM 或待釐清]  
**儲存層**：[例如：PostgreSQL、CoreData、檔案或 N/A]  
**測試框架**：[例如：pytest、XCTest、cargo test 或待釐清]  
**目標平台**：[例如：Linux Server、iOS 15+、WASM 或待釐清]  
**專案型態**：[單一專案／Web／行動裝置，決定目錄結構]  
**效能目標**：[領域指標：1000 req/s、10k lines/sec、60 fps 或待釐清]  
**限制條件**：[領域指標：p95 <200ms、記憶體 <100MB、需支援離線等]  
**規模／範圍**：[例如：10k 用戶、1M LOC、50 個畫面或待釐清]

## 憲法檢查

*關卡：Phase 0 研究前必須通過，Phase 1 設計後需再次確認。*

- 說明雲端同步為權威資料來源，並描述離線回放流程。
- 排程方案需引用 FSRS 參數組並保證輸出可重現。
- 資料 Schema 更新需含版本化 JSON／Prisma 定義、遷移與契約測試。
- 測試策略需覆蓋紅－綠－重構流程與單元／契約／E2E 測試。
- 錯誤處理需提供明確訊息與可追蹤錯誤代碼。
- UI 範圍需同步 Storybook、Tailwind 樣式與視覺／快照驗證。
- 功能範疇須在單一開發週期內完成，避免推測性抽象。

## 專案結構

### 文件（本功能）

```
specs/[###-feature]/
├── plan.md              # 本檔案（/speckit.plan 指令輸出）
├── research.md          # Phase 0 結果（/speckit.plan 指令輸出）
├── data-model.md        # Phase 1 結果（/speckit.plan 指令輸出）
├── quickstart.md        # Phase 1 結果（/speckit.plan 指令輸出）
├── contracts/           # Phase 1 結果（/speckit.plan 指令輸出）
└── tasks.md             # Phase 2 結果（/speckit.tasks 指令產出）
```

### 原始碼（儲存庫根目錄）
<!--
  需依實際結構挑選或延伸以下選項，刪除不使用的部分。
-->

```
# [不使用請移除] 選項一：單一專案（預設）
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [不使用請移除] 選項二：Web（前後端分離）
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [不使用請移除] 選項三：行動裝置 + API
api/
└── [同 backend 結構]

ios/ 或 android/
└── [平台專屬模組、UI 流程、測試]
```

**結構決策**：[記錄實際採用的結構，並引用上述對應目錄]

## 複雜度追蹤

*僅在違反憲法檢查時填寫，說明必要性與被拒方案。*

| 違規項目 | 必要原因 | 被拒絕的較簡方案 |
|---------|---------|----------------|
| [例如：新增第 4 個專案] | [當前需求] | [為何 3 個專案不敷使用] |
| [例如：導入 Repository Pattern] | [特定問題] | [為何直接存取資料庫不可行] |
