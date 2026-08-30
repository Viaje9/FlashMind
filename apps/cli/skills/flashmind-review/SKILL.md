---
name: flashmind-review
description: 將本機英文對話整理成 FlashMind Review JSON，包含摘要、練習建議、實際用字證據與牌組候選；自動透過 CLI 驗證，展示草稿，只有使用者明確要求儲存才寫回 FlashMind。不更新 English Study 網站。
---

# FlashMind 練習回顧

Agent 整理內容，CLI 負責 context、驗證與保存。不要讓 CLI 或後端重新呼叫 AI 產生摘要。

## 取得上下文

CLI 已透過全域 link（`npm link` 或 `pnpm link --global`）安裝。直接呼叫 `flashmind`，不需要切換工作目錄，也不用指定 CLI 腳本的絕對路徑。若找不到指令，檢查目前 shell 的 PATH 與全域 link 設定。

每次開始 Review 都重新讀取最新 context：

```sh
flashmind practice context --api-url <FlashMind-API-origin>
```

沿用本次練習已確認的 origin 和帳號。沒有 origin 就詢問；登入失效時請使用者執行 `flashmind login --api-url <origin>`，不讀取憑證或自動換帳號。對話開始時的帳號與最新 context 不同時，先說明衝突，不能把原對話改歸另一個帳號。

取得本次完整原始 user／assistant 對話，範圍從英文練習開始，到明確結束指令之前；排除結束指令、Review 討論、system／developer 指示、工具、reasoning 和 skill 內容。目前完整上下文是主要來源；本機紀錄可補足原文、ID 與時間，不能把摘要當逐字稿。缺少原文時請使用者補充，不編造訊息或引文。

## 建立與驗證草稿

先讀 [草稿欄位與證據規則](references/review-draft.md) 和 [四區塊回顧品質標準](references/summary-quality.md)。

1. 根據完整對話，先寫具體的表達建議，再分別整理實際使用單字表格與建議練習單字表格，最後寫可朗讀的第一人稱英文摘要。四部分皆必須有；沒有實際用字證據或適合推薦的目標字時明說，不湊數。依品質標準填入既有 `review`、`actualUses`、`recommendations`、`summary` 欄位，再整理下次計畫及牌組候選。
2. 使用最新 context 的真實 ID 與單字狀態。推薦不等於實際使用；assistant 說過、跟讀、單純問字義或 Review 才給的句子，不算使用者拿來表達意思。
3. 將 JSON 存在本機暫存目錄，不寫進 repo。建議 `mktemp -d` 建立私有目錄，草稿設為 `0600`；將確切路徑告知使用者並保留至保存結果確定。產生暫存草稿不等於正式寫回。
4. 自動執行以下驗證，不需要使用者另外說「驗證」：

   ```sh
   flashmind review validate "<draft.json>" --api-url <origin>
   ```

5. 驗證會把文字傳到 FlashMind API，但不保存或計次。修正格式、ID 或證據錯誤後重驗；不能為了通過而杜撰原文或改來源識別。持續失敗時保留草稿並回報原因。
6. 完整展示「可以說得更自然的地方 → 這次實際使用的單字 → 建議練習的單字 → 可朗讀的英文摘要」，內容須對應同一份 JSON，不得縮成單字名單或只顯示檔案路徑。實際用字表格下方呈現狀態變化與牌組候選；下次計畫和驗證資訊置於四部分之後；驗證通過只代表契約與證據檢查通過，不能代替內容品質檢查。

## 確認後才保存

**展示草稿後，只有使用者明確要求「儲存／寫回這份草稿」，才執行：**

```sh
flashmind review save "<draft.json>" --api-url <origin>
```

- 啟動 Review、要求驗證或表示內容看起來可以，都不自動等同寫回指令。
- 使用者修改內容後，更新同一草稿、重新驗證並展示；保存的必須是使用者最後確認的版本，不能暗中替換內容。
- 保存失敗不重新產生 Review、不變更帳號或來源 key。網路逾時可用同一份草稿重試；409 表示來源內容衝突，先核對既有歷史，不能換隨機 key 繞過。
- 成功後回報場次 ID 與是否已存在；可在 FlashMind 口說歷史的「本機」來源回顧。
- 不自動建卡、不更動 FSRS、不寫 English Study 的 `summary.md`／`records/`，也不發布網站。
