## Why

目前 FSRS 排程器使用全域預設參數（`fsrs()`），所有牌組共用相同的學習步驟、重學步驟與目標保留率。不同牌組的學習內容性質差異大（如日常單字 vs 專業術語），使用者需要能針對各牌組微調 FSRS 參數，以獲得最佳的複習間隔體驗。

## What Changes

- Deck model 新增 FSRS 設定欄位：`learningSteps`、`relearningSteps`、`requestRetention`、`maximumInterval`
- FsrsService 從 singleton 排程器改為支援根據牌組設定動態建立 FSRS 實例
- StudyService 在排程計算時傳入對應牌組的 FSRS 設定
- 牌組設定頁面新增 FSRS 參數的編輯表單欄位
- 牌組建立時使用合理預設值，使用者無需手動設定即可正常運作

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `fsrs-scheduling`: 排程計算從全域固定參數改為根據牌組設定動態建立排程器
- `deck-management`: 牌組建立/編輯表單新增 FSRS 參數設定欄位（learningSteps、relearningSteps、requestRetention、maximumInterval）

## Impact

- **資料庫**：Deck table 新增 4 個欄位（需 migration）
- **後端**：`FsrsService`、`StudyService`、Deck 相關 DTO / Controller
- **前端**：牌組建立/編輯表單元件、牌組設定頁面
- **API**：Deck CRUD endpoint 的 request/response 新增 FSRS 欄位
- **OpenAPI**：需更新 Deck 相關 schema
