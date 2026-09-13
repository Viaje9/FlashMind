---
name: flashmind-cli
description: 透過 FlashMind CLI 查詢、整理與摘要既有口說歷史與 Review 資料；適用於歷史回顧、跨場次比較和唯讀資料探索，不用於開始英文練習或建立／保存 Review。
---

# FlashMind CLI 歷史查詢

這個 skill 是一般查詢與整理入口。使用者想看過往練習、比較幾次紀錄、找共同主題或做摘要時使用；不要因此啟動 `$flashmind-practice` 或 `$flashmind-review`。

## 基本邊界

- 預設是唯讀。不要執行 `review prepare`、`review import`、`review refresh`、`review update`、`review validate` 或 `review save`，除非使用者明確要求那個 Review 流程。
- 不要執行 `practice context`，除非使用者明確要看目前目標字或練習計畫。
- CLI 不呼叫 AI；摘要由 Agent 根據實際查到的資料整理，不補寫不存在的內容。
- 不讀取、輸出或分享 session 憑證；不自行切換 API origin 或登入帳號。

## 先確認環境

直接呼叫全域 `flashmind`，不需要切換到 repo，也不需要指定 CLI 腳本路徑。

執行任何 `flashmind` CLI 指令時，一律依目前執行環境的升權流程執行（`require_escalated`）；不要先在受限沙箱重試。升權只解決本機 CLI 的檔案／設定存取問題，不代表取得遠端資料寫入或保存 Review 的授權。

```sh
flashmind status
```

`status` 是本機設定查詢。歷史指令需要有效登入；若尚未登入，說明需要使用者自行執行 `flashmind login`，不要在沒有明確要求時自動開啟登入流程。只有使用者要求驗證連線或 session 時才使用 `flashmind status --check`。

CLI 的 API 優先序是 `--api-url` > `FLASHMIND_API_URL` > 最近成功登入的環境。沿用目前環境；網路錯誤或 5xx 不代表應該換 origin 或帳號。

## 遠端歷史查詢

### 列出場次

```sh
flashmind history list --limit 100
flashmind history list --cursor <nextCursor> --limit 100
```

輸出是 `{ items, meta }`。每個 item 包含場次 ID、來源（`APP`／`LOCAL`）、標題、起訖時間、訊息數、是否已有 Review 和既有摘要。

使用者若要求「全部」、「完整期間」或跨場次統計，依 `meta.nextCursor` 繼續查到 `hasMore: false`；不要只看第一頁就宣稱完整。若只是最近幾場，可以明確說明實際讀取的頁數與範圍。

### 查看單一場次

```sh
flashmind history show <session-id>
```

輸出是 `SpeakingSessionDetail`，包含場次 metadata、已保存的 Review（可能是 `null`）與舊 Summary。若需要根據原文作摘要或既有摘要不足，再讀取訊息：

```sh
flashmind history messages <session-id> --limit 100
flashmind history messages <session-id> --cursor <nextCursor> --limit 100
```

`messages` 同樣依 `meta.nextCursor` 分頁到結束；不要以單頁截斷內容當成完整逐字稿。只引用實際讀到的訊息，保留訊息角色與時間。

## 本機 Review 查詢

若使用者指定的是本機草稿或 Review，而不是 API 歷史，使用：

```sh
flashmind review list --limit 50
flashmind review show <review-id> --section metadata
flashmind review show <review-id> --section summary
flashmind review show <review-id> --section review
flashmind review show <review-id> --section actualUses
flashmind review show <review-id> --section recommendations
flashmind review show <review-id> --section transcript --limit 200
```

這些查詢不需登入、不會連線；它們只代表本機已保存的 Review，不等同遠端歷史全集。要宣稱本機資料完整，也必須依 `nextOffset` 讀完所有頁面。

## 摘要工作方式

1. 先確認範圍：日期、場次數量、來源、主題或使用者指定的單字。
2. 用 `history list` 找到候選場次，記下實際讀取的 ID、時間和來源。
3. 用 `history show` 讀取既有摘要／Review；需要原文證據時再用 `history messages` 完整分頁讀取。
4. 根據已取得的資料整理結果，清楚區分「既有 Review 摘要」與「本次 Agent 彙整」。
5. 回報查詢覆蓋範圍、資料缺口，以及是否有場次尚未 Review；不要把沒有摘要誤說成沒有練習內容。

建議輸出包含：

- 查詢範圍與涵蓋場次
- 重複出現的主題、表達或學習線索
- 有原文支持的代表性例子（標示日期／場次）
- 尚未整理、沒有原文或無法判斷的部分
- 若使用者只要求摘要，不附帶建立 Review、更新單字狀態或保存資料

## 與其他 skill 的轉交

- 使用者要開始或繼續自然英文對話：轉交 `$flashmind-practice`。
- 使用者要把某一場完整對話整理成 Review：轉交 `$flashmind-review`，並保留它的本機驗證與明確保存批准邊界。
- 使用者只要查詢、比較或摘要既有資料：留在本 skill，使用上述唯讀命令。
