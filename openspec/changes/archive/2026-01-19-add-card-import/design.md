# Design: 卡片匯入功能

## Context

FlashMind 使用者可能來自其他閃卡應用（如 Anki、Quizlet）或自行準備學習素材，需要批次匯入卡片。系統需支援結構化的 JSON 格式，讓使用者能一次匯入多張卡片。

## Goals / Non-Goals

### Goals

- 提供簡單的 JSON 格式讓使用者批次匯入卡片
- 在牌組詳情頁提供明確的匯入入口
- 匯入前顯示預覽，讓使用者確認內容
- 顯示匯入結果（成功/失敗數量）

### Non-Goals

- 不支援 CSV、Excel 等其他格式（未來可擴充）
- 不支援 Anki 原生格式直接匯入（格式轉換由使用者處理）
- 不支援匯出功能（另案處理）
- 不支援跨牌組匯入（一次只匯入到單一牌組）

## Decisions

### JSON 匯入格式

採用簡潔的 JSON 陣列格式，與現有 `CreateCardRequest` 結構對齊：

```json
{
  "cards": [
    {
      "front": "hello",
      "meanings": [
        {
          "zhMeaning": "你好",
          "enExample": "Hello, how are you?",
          "zhExample": "你好，你好嗎？"
        }
      ]
    },
    {
      "front": "world",
      "meanings": [
        {
          "zhMeaning": "世界"
        }
      ]
    }
  ]
}
```

**設計理由**：

- 與現有 `CreateCardRequest` schema 一致，降低學習成本
- `meanings` 為陣列，支援多詞義結構
- `enExample` 和 `zhExample` 為選填，提供彈性

### UI 入口位置

在牌組詳情頁的 PageHeader 右側新增「匯入」按鈕（設定按鈕旁邊）：

```text
[←]  牌組名稱  [匯入] [設定]
```

**設計理由**：

- 匯入是牌組層級的操作，放在 PageHeader 符合操作層級
- 與新增卡片（FAB）區分：FAB 用於單張快速新增，匯入用於批次操作
- 避免修改 FAB 行為，保持單一職責

### 匯入頁面流程

1. **輸入階段**：提供 textarea 讓使用者貼上 JSON，或上傳 `.json` 檔案
2. **預覽階段**：解析 JSON 後顯示卡片列表預覽，標示格式錯誤的項目
3. **確認匯入**：使用者確認後送出 API
4. **結果顯示**：顯示成功/失敗數量，提供返回牌組的按鈕

### API 設計

```text
POST /decks/{deckId}/cards/import

Request:
{
  "cards": [CreateCardRequest, ...]
}

Response (201):
{
  "data": {
    "total": 10,
    "success": 9,
    "failed": 1,
    "errors": [
      { "index": 3, "message": "front 欄位為必填" }
    ]
  }
}
```

**設計理由**：

- 部分成功模式：允許部分卡片匯入成功，回傳詳細錯誤資訊
- 回傳 `index` 讓前端可標示哪張卡片失敗

### 路由規劃

新增路由：`/decks/:id/cards/import`

## Risks / Trade-offs

| 風險                     | 緩解措施                               |
| ------------------------ | -------------------------------------- |
| 使用者不熟悉 JSON 格式   | 提供範例 JSON 下載、格式說明文件       |
| 格式驗證複雜             | 前端先做基本驗證，後端做完整驗證       |

## Open Questions

- [ ] 是否需要支援匯入時自動呼叫 AI 生成內容？（建議暫不支援，保持簡單）
- [ ] 匯入失敗的卡片是否要提供修正後重試的功能？（建議 MVP 暫不支援）
