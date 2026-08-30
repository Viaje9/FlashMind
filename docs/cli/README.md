# FlashMind CLI 與本機練習

CLI 放在 `apps/cli`，共用驗證放在 `packages/shared`。它不讀取 ChatGPT 私有資料庫，也不呼叫 AI。對話由 Agent／使用者提供，Agent 產生 Review 草稿，CLI 取得上下文、驗證和保存。

## 建置與執行

需要 Node.js 22+ 與專案指定的 pnpm。

```sh
pnpm install
pnpm build:cli
node /絕對路徑/FlashMind/apps/cli/bin/flashmind.cjs --help
```

若要從任意目錄直接使用 `flashmind`，在 repo 根目錄建立 pnpm 全域連結（先確認沒有其他同名指令）：

```sh
pnpm --dir apps/cli link --global
flashmind --help
export FLASHMIND_API_URL=https://你的API主機
flashmind login
```

若出現 `ERR_PNPM_NO_GLOBAL_BIN_DIR`，先執行一次 `pnpm setup`，重新開啟終端機讓 PATH 生效，再執行 link。這是 pnpm 對應 npm link 的本機使用方式，不會發布套件；詳見 [pnpm link](https://pnpm.io/10.x/cli/link)。

連結指向目前 checkout。修改 CLI TypeScript 後執行 `pnpm build:cli` 即可使用新版本，不必每次重新 link；搬移專案或改用其他 checkout 時才需重建連結。

`FLASHMIND_API_URL` 是 origin，可附 `/api`；也能每次傳 `--api-url`。只允許 HTTPS，localhost 開發例外。API 和 App 不同主機時，指定 API 的主機，不要填 OpenAI 網址。

登入會開啟 App 確認頁，顯示目前帳號並要求輸入終端機的配對碼。尚未登入可從確認頁另開 Email／Google 登入頁，登入後重新整理原確認頁。授權五分鐘失效，只能兌換一次。`--no-browser` 可改為手動開啟確認頁。

CLI session 保存在 repo 外的 `~/.config/flashmind`，檔案 `0600`、目錄 `0700`，不同 origin 各自保存。登入成功後有效 30 日，使用時不自動延長；舊 session 不會自動延長，須在更新 API 後重新 login 才取得 30 日期限。可透過 `FLASHMIND_CONFIG_DIR` 指定另一個 repo 外目錄。不要提交、分享或列印憑證檔；失效時重新執行 login。這是 FlashMind 登入 session，不是 OpenAI API key。

## 全域 Practice／Review skills

兩個 skill 和 CLI 放在一起維護：

```text
apps/cli/
├── skills/
│   ├── flashmind-practice/SKILL.md
│   └── flashmind-review/SKILL.md
└── scripts/
    ├── sync-skills.mjs
    └── skill-cli.cjs
```

在 repo 根目錄執行：

```sh
pnpm build:cli
pnpm skills:sync --dry-run
pnpm skills:sync
```

也可以使用 `pnpm --filter @flashmind/cli skills:sync`。預設同步到 `$CODEX_HOME/skills`，未設定 CODEX_HOME 時使用 `~/.codex/skills`，沿用目前本機的全域 skill 位置；可用 `--target-dir <目錄>` 指定其他位置。新版通用使用者位置也可指定為 `~/.agents/skills`，同一組 skill 請選一處安裝，避免重複出現。

script 複製兩個 skill 與參考資料，不會把 API key、登入憑證或對話複製進 skill。兩個 skill 都直接呼叫全域 link 的 `flashmind`，需讓目前 shell 的 PATH 找得到此指令；不需要切換工作目錄或指定 CLI 腳本的絕對路徑。CLI 本體仍在此 repo；搬移 repo 或改用其他 checkout 後須重新 build／link／sync。

- 只替換由本 script 管理的 `flashmind-practice`／`flashmind-review` 目錄；受管理目錄中的手動修改會被下一次同步取代，請修改 repo 原始碼。
- 未受管理的同名目錄、檔案或 symlink 會被拒絕，其他 skill 不會被修改；沒有自動強制覆寫選項。
- `--dry-run` 只核對來源、目標與衝突，不建立資料夾。
- 不修改既有的 `english-speaking-practice`／`english-study-review`，它們仍保留 English Study 的流程。

同步後，可在本機 Agent 明確使用 `$flashmind-practice`，例如：「使用 `$flashmind-practice`，API 是 `http://localhost:3280`，開始今天的練習。」第一次需登入同一個 API 環境；不要因 localhost 無法連線就自行改成正式站。

結束練習後交給 `$flashmind-review`，自動產生暫存草稿、驗證、展示，等使用者明確說「儲存」才執行 save。獨立 Review 也可直接使用 `$flashmind-review` 並提供完整原始對話。

依 [OpenAI 的 skill 說明](https://developers.openai.com/codex/skills)，skill 更新通常會自動偵測；如果清單尚未出現，重新啟動 Codex。這兩個 skill 需要能執行本機 CLI 的環境，不會擷取無法存取的聊天紀錄。

## 四個命令

| 命令                                    | 用途                                                  | 是否保存學習紀錄 |
| --------------------------------------- | ----------------------------------------------------- | ---------------- |
| `flashmind login`                       | 瀏覽器確認帳號、取得 session                          | 否，只有登入授權 |
| `flashmind practice context`            | 完整四狀態目標字表、最近 Summary、下次計畫            | 否               |
| `flashmind review validate review.json` | 本機格式檢查，再傳至 API 驗證最新字表、帳號與證據     | 否               |
| `flashmind review save review.json`     | 重驗同一份檔案快照後，原子保存對話、Review 與單字事件 | 是               |

`validate` 會把文字傳給 API，但不保存遠端草稿、不呼叫 AI、不計次。檔案仍由你控制。輸出預設是一份完整 JSON；提示寫在 stderr。help 輸出說明文字。

| Exit code | 意義                                   |
| --------- | -------------------------------------- |
| 0         | 成功                                   |
| 2         | 參數／設定／JSON 解析錯誤              |
| 3         | 未登入、過期、取消或無權限             |
| 4         | 驗證失敗、上下文不完整或超過上限       |
| 5         | 相同來源已有不同內容、授權已兌換等衝突 |
| 6         | 網路／伺服器／非預期回應錯誤           |

## 草稿契約

完整 schema 位於 `openapi/speaking-history.yaml` 的 `SpeakingReviewDraft`，執行 `pnpm generate:speaking-contract` 產生共用型別和 AJV schema。Web client 使用 `pnpm --filter web generate:api`，JSON 的唯一陣列仍是 Array，不應序列化為 Set。

- `schemaVersion`：第一版固定 1。
- `target`：明確的 `apiOrigin` 和 `userId`；必須和 CLI 登入相符。
- `contextVersion`：practice context 的 `vocabularyVersion`。
- `practice.source`：本機 Agent 固定 `LOCAL`，App 為 `APP`。
- `sourceRef`：穩定的系統、對話、練習段落識別。重試不可改識別；另一場新練習才用新的 `sessionKey`。
- `messages`：依時間排序的完整原始對話，只含 user／assistant。不可用潤飾句取代原文、不可上傳音訊。LOCAL 必須提供文字。
- `range`：第一、最後一則訊息的穩定 ID。
- `result`：Summary、Review、使用事件、推薦事件、下一次計畫和加入牌組候選。
- 每個 actualUse 必須有目標字 ID、原始 user 訊息 ID 與實際引文。字詞必須為獨立詞／詞組；assistant 提到、substring 或推測的字形不算使用。
- 自然化例句和原文引文分開。候選必須來自本次實際使用；只提供候選，不自動建卡或改 FSRS。
- 同一份內容重試不重複計次。相同來源修改內容會回傳 409；第一版不覆寫已保存的 Review。
- 每個請求上限 2 MiB、每場最多 2000 則訊息。context 必須完整，不會只取待練習或第一頁。

`examples/review.valid.json` 使用虛構 origin、帳號及單字 ID，僅供格式參考；需換成實際 context 中的值才能線上驗證。`review.invalid-assistant-evidence.json` 刻意引用 assistant，應驗證失敗。

## Practice skill 整合

1. 呼叫 `flashmind practice context`，核對完整字數、四種狀態與帳號；錯誤時停止使用舊 context。
2. 將最近 Summary、下一次計畫和字表作為背景，維持自然英文對話。
3. 保留原始訊息、說話者、穩定訊息 ID 與時間。CLI 不負責偷偷擷取 App 對話。
4. Practice 不儲存 Review，也不自動把任何單字標成已使用。

## Review skill 整合

1. 取得本次完整對話。若 Review 是獨立呼叫，先重新執行 `practice context`。
2. Agent 產生本機暫存 JSON，包含摘要、建議、真實使用證據和候選。
3. Skill 自動執行 `review validate`，不需要使用者另外說「驗證」。失敗時修正草稿再驗證。
4. 在對話窗展示草稿內容、單字變化與驗證結果，讓使用者 review。驗證通過不代表取得保存許可。
5. 只有使用者明確要求儲存，才執行 `review save`。
6. 若使用者修改草稿，重新驗證；保存失敗不重新生成、不換帳號、不改來源識別，以同一份草稿重試。

上述流程已實作在 `apps/cli/skills/flashmind-practice` 與 `flashmind-review`，透過同步 script 安裝；不修改 `english-study` 或其他位置原有的 Practice／Review skills。

## App 回顧與搬移

App 建立場次、追加訊息、搬移與 CLI 授權確認都帶 `expectedUserId`；即使另一個分頁換了 session，後端也會拒絕把舊分頁資料寫進新帳號。

口說歷史從後端讀取，來源只分「App／本機」。App 未整理的紀錄可以繼續追加；已整理或本機來源只能延續為新練習，原場次不變。

原始音訊仍在原裝置；其他瀏覽器顯示音訊不可用，但文字、Review 和舊摘要可回顧。容量清理只刪可清理的本機音訊，不刪文字或未同步場次。

歷史頁的搬移入口會列出未歸屬的 IndexedDB 舊資料。選取並確認帳號後才上傳；逐場顯示結果，原備份與音訊保留。多份舊 Summary 原樣保存，不重跑 AI，不產生新單字事件。無法唯一對應的舊練習計畫留在本機。

刪除歷史會移除遠端可回顧的文字、Review 與詳細證據，不回退已累積次數、不刪卡。後端保留不含原文的最小防重 receipt，因此重送或重新搬移不能使已刪除的場次復活。
