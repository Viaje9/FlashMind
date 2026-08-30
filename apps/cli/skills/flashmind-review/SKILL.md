---
name: flashmind-review
description: 將本機英文對話整理成 FlashMind Review JSON，透過 CLI 在本機驗證原句證據與字庫快照並展示草稿；只有使用者明確要求儲存才上傳至已確認的 FlashMind API，由後端驗證並寫回學習紀錄。不更新 English Study 網站。
---

# FlashMind 練習回顧

Agent 整理內容，CLI 負責本機資料管理、context、檢查、驗證與保存。不要讓 CLI 或後端重新呼叫 AI 產生摘要；不要再自行撰寫 Python／JS 讀取、篩選或組裝逐字稿、context 和完整草稿。

## 本機驗證與保存的授權界線

- `flashmind review validate <id>` 完全在本機驗證，不需登入、不連線、不上傳，也不改寫資料檔。Review 流程不呼叫遠端 `/reviews/validate`；沒有 `review check` 指令。
- `prepare`／`import`／`refresh` 會 GET 最新 context，但不傳送逐字稿。若使用者要求完全離線，使用既有本機資料並明示快照可能過期，不自動刷新。
- 只有使用者明確要求儲存，才呼叫 `flashmind review save`。保存前核對並告知 API origin 與帳號；只送到本次練習已確認的環境，目的地或帳號不符時先停止確認，不自行切換。
- `save` 會上傳整份 draft，包括指定練習範圍的完整 user／assistant 逐字稿、訊息 ID 與時間、來源識別、回顧、單字證據及必要帳號識別。它直接呼叫保存 API，由後端核對當下帳號、環境、字庫、原句證據與來源衝突，再保存紀錄及更新次數。不呼叫 AI、不自動建卡，不夾帶完整 context、管理收據、其他任務、repo 檔案或音訊；認證交由 CLI 處理。
- 本機驗證成功不代表伺服器當下狀態相同，亦不構成保存許可。保存失敗的請求仍可能已傳送到伺服器或留下基礎設施日誌。執行環境若拒絕上傳，保留草稿、說明實際目的地與傳送範圍，依要求取得批准；不以改指令、換工具或換路徑繞過。

## 取得上下文

CLI 已透過全域 link（`npm link` 或 `pnpm link --global`）安裝。直接呼叫 `flashmind`，不需要切換工作目錄，也不用指定 CLI 腳本的絕對路徑。若找不到指令，檢查目前 shell 的 PATH 與全域 link 設定。

先核對目前環境與帳號，再尋找本機草稿：

```sh
flashmind status
flashmind review list
```

`review list` 依更新時間分頁，須依回傳的 `nextOffset` 繼續查看才能確認是否已有該場次；不得猜最近一場。每次開始 Review 都用 `prepare` 或 `refresh` 取得最新完整 context，由 CLI 保存，不必把兩千字的完整 JSON 印出再另寫程式篩選。

CLI 優先序為 `--api-url` > `FLASHMIND_API_URL` > 最近成功登入的環境；已設定時不必重複指定 URL。只有尚未設定環境才詢問 origin，初次登入使用 `flashmind login --api-url <origin>`；同環境重新登入可直接 `flashmind login`。`status` 是本機狀態，`status --check` 才驗證 API。網路或 5xx 錯誤不切換環境、不清除登入。若沙箱內出現存取或設定錯誤，先依執行環境的權限流程確認是否為沙箱限制，不逕自判定憑證損壞、讀取憑證或重新登入。

沿用本次練習已確認的 origin 和帳號；若與目前環境不同，各指令明確帶原本的 `--api-url`，不要把對話改歸另一個帳號。不得讀取憑證或自動換帳號；最新 context 的帳號不符時先說明衝突。

取得本次完整原始 user／assistant 對話，範圍從英文練習開始，到明確結束指令之前；排除結束指令、Review 討論、system／developer 指示、工具、reasoning 和 skill 內容。目前完整上下文是主要來源；本機紀錄可補足原文、ID 與時間，不能把摘要當逐字稿。缺少原文時請使用者補充，不編造訊息或引文。

### Codex 語音逐字稿

使用 CLI 讀取本機原始語音訊息，不自行撰寫 Python／JS 擷取腳本：

```sh
flashmind transcript show --current --offset 0 --limit 50
```

未指定其他任務時使用 `--current`，CLI 讀取 `CODEX_THREAD_ID`；使用者提供任務 ID 或連結時，用它取代 `--current`，兩者不可混用。環境變數不存在或格式錯誤時會報錯，不猜最近任務。

`transcript show` 分頁讀取原始語音，標示 `reviewReady: false`，可能包含結束指令及 Review 討論。依 `nextOffset` 讀完全部頁面，根據原文找出練習起訖，不要求使用者自行尋找訊息 ID；只有無法判斷是哪一場時才詢問。確定範圍後：

```sh
flashmind review prepare --current --from-message <開始訊息ID> --before-message <結束指令訊息ID> --title "本次主題"
```

`prepare` 保留開始訊息、排除結束指令，GET 最新 context 後保存本機資料並回傳固定 `id` 與路徑，不上傳逐字稿。指定其他任務時仍以它取代 `--current`。`transcript show/export` 完全離線，從 `CODEX_HOME`（預設 `~/.codex`）讀取原始 realtime 訊息，忽略重複 handoff；沒有原文時不以摘要補寫。舊 `transcript export` 仍可用於明確要求匯出檔案的情境。

同場已有本機 `id` 時使用 `review refresh <id>`，保留逐字稿與草稿，重新取得 context。刷新失敗須說明，不能悄悄把舊 context 當最新資料。刷新造成版本不同時，CLI 標示 `context-stale`；核對後以 `update` 重新組裝，不自行修改 contextVersion。

若已有舊版完整草稿但尚未納入管理，使用 `review import --file <既有草稿.json>`，保留原有 sourceRef，不要重新 prepare 產生不同 sessionKey。此命令只 GET context，不上傳草稿；若 context 版本不同，匯入後先核對與更新。純文字練習可根據可取得的完整原文、真實 ID 和時間撰寫契約草稿，再用同一 import 流程；不能用腳本重建不存在的原文。

### 固定資料位置與 CLI 讀取

資料預設位於 repo 外的 `~/.local/share/flashmind/reviews/<環境帳號識別>/<來源識別>/review.json`；可用 `FLASHMIND_DATA_DIR` 自訂根目錄。CLI 將逐字稿、context、草稿及保存收據放在同一資料檔並原子更新，目錄 `0700`、檔案 `0600`，不含登入憑證。不會隨系統清除暫存而消失，也不自動刪除；本機持久保存仍不等於正式寫回 API。

```sh
flashmind review show <id> --section transcript --offset 0 --limit 50
flashmind review show <id> --section context
flashmind review vocabulary <id> --terms task,limited
flashmind review vocabulary <id> --offset 0 --limit 100
```

透過 `nextOffset` 完整讀取選定練習，不因分頁截斷 Review。`context` 區塊含最近練習、下次計畫與快照時間；字庫以 `vocabulary` 查詢 canonical ID、狀態和釋義。要瀏覽完整字庫時分頁讀取，不能因只查少數字就宣稱沒有其他合適目標字。以上查閱指令完全離線、不需登入；沒有取得最新 context 時須明示限制。

## 建立與驗證草稿

先讀 [草稿欄位與證據規則](references/review-draft.md) 和 [四區塊回顧品質標準](references/summary-quality.md)。

1. 根據完整對話，先寫具體的表達建議，再分別整理實際使用單字表格與建議練習單字表格，最後寫可朗讀的第一人稱英文摘要。四部分皆必須有；沒有實際用字證據或適合推薦的目標字時明說，不湊數。依品質標準填入既有 `review`、`actualUses`、`recommendations`、`summary` 欄位，再整理下次計畫及牌組候選。
2. 使用最新 context 的真實 ID 與單字狀態。推薦不等於實際使用；assistant 說過、跟讀、單純問字義或 Review 才給的句子，不算使用者拿來表達意思。
3. Agent 只撰寫 `result` 物件（可先放在 `mktemp -d` 私有暫存目錄的 `0600` JSON 檔），不用讀取或拼接原始資料檔。用 CLI 自動帶入固定的 target、practice 與最新 contextVersion：

   ```sh
   flashmind review update <id> --result <result.json>
   flashmind review validate <id>
   flashmind review show <id> --section result
   ```

   `update` 驗證失敗保留原草稿；`validate` 檢查本機契約、字庫 ID、原句證據與來源一致性，不連線，也不能判斷是否只是跟讀或教學品質。展示時可用 `show --section review|actualUses|recommendations|summary|nextPractice|deckCandidates` 分區讀取，內容必須對應存入的 result。告知固定草稿 ID 與 CLI 回傳的確切路徑。

4. 本機驗證失敗時，修正格式、ID 或證據後重驗；不能為了通過而杜撰原文或改來源識別。持續失敗時保留草稿並回報原因。用 ID 的結果為 `scope: local-snapshot`；若直接驗證舊完整草稿檔，只有 `scope: draft-only` 的契約與原句檢查，沒有字庫／帳號核對，應先 import 納管後再以 ID 驗證。
5. 完整展示「可以說得更自然的地方 → 這次實際使用的單字 → 建議練習的單字 → 可朗讀的英文摘要」，內容須對應同一份 JSON，不得縮成單字名單或只顯示檔案路徑。實際用字表格下方呈現狀態變化與牌組候選；下次計畫和驗證資訊置於四部分之後。回報「本機驗證通過、尚未上傳或保存」，不要稱為 API 驗證通過；本機驗證也不能代替內容品質檢查。

## 確認後才保存

**展示草稿後，只有使用者明確要求「儲存／寫回這份草稿」，才執行：**

```sh
flashmind review save <id>
```

- 啟動 Review、要求驗證或表示內容看起來可以，都不自動等同寫回指令。
- 使用者修改內容後，以 `review update` 更新同一草稿、重新檢查與驗證並展示；保存的必須是使用者最後確認的版本，不能暗中替換內容。
- 保存失敗不重新產生 Review、不變更帳號或來源 key。網路逾時可用同一份草稿重試；409 表示來源內容衝突，先核對既有歷史，不能換隨機 key 繞過。
- 成功後回報場次 ID 與是否已存在；可在 FlashMind 口說歷史的「本機」來源回顧。
- 不自動建卡、不更動 FSRS、不寫 English Study 的 `summary.md`／`records/`，也不發布網站。
