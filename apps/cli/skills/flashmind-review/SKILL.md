---
name: flashmind-review
description: 將本機英文對話整理成 FlashMind Review JSON，包含摘要、練習建議、實際用字證據與牌組候選；透過 CLI 將指定練習逐字稿與草稿送到已確認的 FlashMind API 驗證，展示草稿，只有使用者明確要求儲存才寫回學習紀錄。不更新 English Study 網站。
---

# FlashMind 練習回顧

Agent 整理內容，CLI 負責 context、驗證與保存。不要讓 CLI 或後端重新呼叫 AI 產生摘要。

## API 驗證的資料傳送與授權界線

- 本技能的 Review 流程包含 API 驗證，不是純離線整理。使用者明確呼叫本技能進行 Review 時，預期流程包含下述限定範圍的驗證；若只要求修改技能、解釋流程、離線草稿或禁止上傳，不執行 API 驗證。
- 驗證前核對並告知本次 FlashMind API origin 與帳號。只送到本次練習已確認的環境；登入狀態本身不代表可任意上傳資料。目的地或帳號未確認、與練習不符時先停止確認，不自動換環境或帳號。
- `flashmind review validate` 會送出整份 Review JSON，包含使用者指定練習範圍的完整 user／assistant 逐字稿、訊息 ID 與時間、來源識別、回顧與單字證據、必要帳號識別資訊。不是只傳格式或檔案雜湊；不夾帶其他任務、repo 檔案、音訊或無關資料，認證交由 CLI 處理。
- API 用於檢查契約、目標帳號／環境、目標單字 ID 與原句證據，不呼叫 AI 重新產生回顧，不保存學習紀錄、不計次、不建卡。這不等於保證服務端或基礎設施完全沒有請求日誌。
- 「尚未寫回」指尚未正式保存學習紀錄，不代表沒有資料離開本機。驗證與儲存是不同操作；驗證完成仍須依下方規則，取得明確儲存指示才可 save。
- 本說明用於揭露流程與界定範圍，不取代執行環境的權限或安全審查，也不保證自動放行。提出執行申請時說明實際目的地、傳送內容及不保存的用途；若審查認定授權不足，保留草稿，向使用者說明並取得明確傳送同意後再申請，不以改指令、換工具或換路徑繞過。

## 取得上下文

CLI 已透過全域 link（`npm link` 或 `pnpm link --global`）安裝。直接呼叫 `flashmind`，不需要切換工作目錄，也不用指定 CLI 腳本的絕對路徑。若找不到指令，檢查目前 shell 的 PATH 與全域 link 設定。

每次開始 Review 都重新讀取最新 context：

```sh
flashmind status
flashmind practice context
```

先以 `status` 核對目前有效 origin 與帳號，再讀取最新 context。CLI 優先序為 `--api-url` > `FLASHMIND_API_URL` > 最近成功登入的環境；已設定時不必重複指定 URL。只有尚未設定環境才詢問 origin，初次登入使用 `flashmind login --api-url <origin>`；同環境重新登入可直接 `flashmind login`。`status` 是本機狀態，`status --check` 才驗證 API。網路或 5xx 錯誤不切換環境、不清除登入。

沿用本次練習已確認的 origin 和帳號；若與目前環境不同，各指令明確帶原本的 `--api-url`，不要把對話改歸另一個帳號。不得讀取憑證或自動換帳號；最新 context 的帳號不符時先說明衝突。

取得本次完整原始 user／assistant 對話，範圍從英文練習開始，到明確結束指令之前；排除結束指令、Review 討論、system／developer 指示、工具、reasoning 和 skill 內容。目前完整上下文是主要來源；本機紀錄可補足原文、ID 與時間，不能把摘要當逐字稿。缺少原文時請使用者補充，不編造訊息或引文。

### Codex 語音逐字稿

使用 CLI 讀取本機原始語音訊息，不自行撰寫 Python／JS 擷取腳本：

```sh
flashmind transcript export --current --output-temp
```

未指定其他任務時使用 `--current`，CLI 讀取 `CODEX_THREAD_ID`；使用者提供任務 ID 或連結時，用它取代 `--current`，兩者不可混用。環境變數不存在或格式錯誤時會報錯，不猜最近任務。

沒有指定邊界時，CLI 匯出完整原始語音快照並標示 `reviewReady: false`，可能包含結束指令及 Review 討論，不能直接作為草稿的 practice。Agent 根據原文與當前上下文找出練習起訖，再以 `--current --before-message <結束指令訊息ID> --output-temp` 取得範圍內資料；需要排除開頭或其他場次時加 `--from-message <開始訊息ID>`。不要求使用者執行 `--list` 或尋找訊息 ID；只有無法判斷是哪一場時才詢問。

指定邊界的匯出保留開始訊息、不包含結束指令，回傳私有暫存檔路徑。也可用 `--output <新檔案>`，CLI 拒絕覆蓋既有檔案；`--list` 僅保留舊用法相容性。

此指令完全離線，不需要 API origin 或登入；從 `CODEX_HOME`（預設 `~/.codex`）的 sessions／archived_sessions 讀取原始 realtime 訊息，忽略重複 handoff。沒有原始語音紀錄時會報錯，不以摘要補寫。純文字練習仍使用可取得的完整原始對話。

輸出的 `practice` 可直接用於草稿，再補上 title；首次使用保留輸出的 sourceRef。同一練習已有草稿或保存紀錄時，沿用既有 sourceRef，不能因新匯出器而換 sessionKey；來源內容不同造成 409 時先核對既有紀錄。

## 建立與驗證草稿

先讀 [草稿欄位與證據規則](references/review-draft.md) 和 [四區塊回顧品質標準](references/summary-quality.md)。

1. 根據完整對話，先寫具體的表達建議，再分別整理實際使用單字表格與建議練習單字表格，最後寫可朗讀的第一人稱英文摘要。四部分皆必須有；沒有實際用字證據或適合推薦的目標字時明說，不湊數。依品質標準填入既有 `review`、`actualUses`、`recommendations`、`summary` 欄位，再整理下次計畫及牌組候選。
2. 使用最新 context 的真實 ID 與單字狀態。推薦不等於實際使用；assistant 說過、跟讀、單純問字義或 Review 才給的句子，不算使用者拿來表達意思。
3. 將 JSON 存在本機暫存目錄，不寫進 repo。建議 `mktemp -d` 建立私有目錄，草稿設為 `0600`；將確切路徑告知使用者並保留至保存結果確定。產生暫存草稿不等於正式寫回。
4. 在上述資料傳送範圍與授權界線內，自動執行以下驗證；一般 Review 流程不需要使用者另外說「驗證」，但不能略過執行環境要求的批准：

   ```sh
   flashmind review validate "<draft.json>"
   ```

5. 驗證會將上述整份 JSON 傳到已確認的 FlashMind API，但不保存學習紀錄或計次。修正格式、ID 或證據錯誤後重驗；不能為了通過而杜撰原文或改來源識別。持續失敗時保留草稿並回報原因；權限或安全審查拒絕依上述授權界線處理。
6. 完整展示「可以說得更自然的地方 → 這次實際使用的單字 → 建議練習的單字 → 可朗讀的英文摘要」，內容須對應同一份 JSON，不得縮成單字名單或只顯示檔案路徑。實際用字表格下方呈現狀態變化與牌組候選；下次計畫和驗證資訊置於四部分之後；驗證通過只代表契約與證據檢查通過，不能代替內容品質檢查。

## 確認後才保存

**展示草稿後，只有使用者明確要求「儲存／寫回這份草稿」，才執行：**

```sh
flashmind review save "<draft.json>"
```

- 啟動 Review、要求驗證或表示內容看起來可以，都不自動等同寫回指令。
- 使用者修改內容後，更新同一草稿、重新驗證並展示；保存的必須是使用者最後確認的版本，不能暗中替換內容。
- 保存失敗不重新產生 Review、不變更帳號或來源 key。網路逾時可用同一份草稿重試；409 表示來源內容衝突，先核對既有歷史，不能換隨機 key 繞過。
- 成功後回報場次 ID 與是否已存在；可在 FlashMind 口說歷史的「本機」來源回顧。
- 不自動建卡、不更動 FSRS、不寫 English Study 的 `summary.md`／`records/`，也不發布網站。
