## Why

使用者在牌組設定中可配置每日新卡數與複習數上限，但這是固定值。當使用者某天想多練習或多複習時，目前沒有彈性調整的方式，只能去修改牌組設定（影響往後每天）。需要一個「今日限定覆寫」機制，讓使用者能臨時提高單日上限，隔天自動恢復預設。

## What Changes

- 在 Deck 模型新增 3 個 nullable 欄位：`overrideDate`、`overrideNewCards`、`overrideReviewCards`
- 學習卡片選取邏輯改為優先使用覆寫值（當 `overrideDate` 等於當日學習日時）
- 學習摘要 API 回傳 effective limit（考慮覆寫後的實際上限）
- 牌組詳情頁新增「調整今日上限」的操作入口
- 新增設定今日覆寫的 API 端點
- 覆寫值只能 >= 預設值（只能加量，不能減量）

## Capabilities

### New Capabilities
- `daily-limit-override`: 單日學習上限覆寫機制，允許使用者臨時提高某牌組的當日新卡或複習上限

### Modified Capabilities
- `study-session`: 學習卡片選取邏輯需考慮覆寫值，摘要需回傳 effective limit
- `daily-progress`: 進度顯示的分母需改為 effective limit（覆寫值或預設值）

## Impact

- **資料庫**: Deck 表新增 3 個欄位，需 migration
- **後端 API**: 新增覆寫端點、修改 study cards 與 summary 邏輯
- **OpenAPI 契約**: 新增覆寫相關 schema 與端點定義
- **前端**: 牌組詳情頁新增覆寫 UI、進度顯示邏輯調整
- **API Client**: 需重新生成以包含新端點
