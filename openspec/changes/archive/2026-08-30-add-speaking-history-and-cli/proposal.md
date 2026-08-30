## Why

目前 Speaking 文字對話、Summary 與下次練習資訊保存在瀏覽器，無法在同一帳號的其他裝置回顧，也無法讓本機 Agent 的練習結果進入口說歷史。需要以後端保存文字學習紀錄，並提供 CLI 讓 Practice skill 讀取上下文、Review skill 在使用者確認後寫回結果。

## What Changes

- 後端保存 Speaking 場次、原始文字對話、Summary／Review、單字事件及下次練習建議；App 與本機匯入共用口說歷史。來源只有「App」與「本機」，不細分裝置。
- 口說歷史從 API 讀取列表與明細，點入可回顧完整文字與已保存的整理結果；App 對話不必等到 Summary 才能保存。
- 原始音訊留在原瀏覽器，不新增音訊雲端保存或同步；音訊不可用、清除或達到容量上限時，不得刪除後端文字。
- App 提供既有 IndexedDB 文字紀錄搬移，保留原有時間、對話與舊 Summary；可重試、避免重複，不重新分析或重算單字次數。
- 在 `apps/cli` 提供四個指令：`flashmind login`、`flashmind practice context`、`flashmind review validate <file>`、`flashmind review save <file>`。
- Practice context 提供完整目標單字與四種狀態、最近練習摘要和下次練習建議；不篩成只有「待練習」。
- Agent 負責分析、產生本機 JSON 草稿與展示。Review skill 自動驗證草稿，修改後重新驗證；使用者明確要求儲存後，才呼叫寫回指令。CLI 不呼叫 AI 產生摘要。
- 寫回時再次驗證，原子保存場次／Review／單字事件，避免重試重複計次；實際使用須附使用者原始訊息證據，推薦與已加入牌組不可被混同。
- **BREAKING**：Speaking Summary 從「分析時立即更新單字」改成「分析不改學習狀態，由保存 Review 統一更新」。App 與 CLI 需同時改用新的保存契約，避免舊入口重複計次。

### 非目標

- 不實作 ChatGPT／Codex 本機歷史自動擷取、語音辨識或通用聊天平台連接器；Agent 提供已界定練習範圍的文字。
- 不新增 CLI 生成摘要、建草稿、加入牌組或搬移 IndexedDB 的指令；加入牌組沿用 App 既有操作。
- 不修改 English Study 外部專案的既有 skill，不同步其網站、檔案或本機記憶；提供本專案的 skill 整合契約與範例。
- 不合併既有「主題對話」學習模式，不搬移所有裝置設定，不提供完整離線跨裝置合併或已儲存 Review 的改版重算。

## Capabilities

### New Capabilities

- `speaking-history`: 帳號隔離的後端文字歷史、App／本機來源、跨裝置回顧與本機音訊相容。
- `speaking-history-migration`: App 將舊 IndexedDB 文字與整理結果安全搬移，不重做分析或單字狀態變更。
- `speaking-practice-context`: 取得完整目標單字狀態與可延續的最近練習／下次計畫。
- `speaking-review-recording`: 草稿資料契約、證據驗證、原子保存、狀態轉移與冪等處理。
- `flashmind-cli`: 四個 CLI 指令、機器可讀輸出、Practice／Review skill 分工與明確寫入邊界。

### Modified Capabilities

- `account-auth`: 增加 CLI 登入授權與本機憑證保存要求，沿用帳號、session 與既有登入方式。

## Impact

- `apps/api`：Speaking 歷史、上下文、Review 驗證／保存 API；調整 Summary 副作用；整合 TargetVocabulary 交易與 session 認證。
- `apps/api/prisma`：新增場次、訊息、Review／單字事件、搬移識別與 CLI 短期登入授權資料，補上唯一限制及使用者查詢索引。
- `apps/web`：Speaking Store／Repository、口說歷史列表／明細、搬移入口、音訊本機關聯與 CLI 登入授權畫面。
- `apps/cli`：新增可獨立執行的 Node.js／TypeScript workspace；API 呼叫不可依賴 Angular runtime。
- `packages/shared`、`openapi/api.yaml`、`packages/api-client`：共用資料契約及純驗證規則、OpenAPI operationId、既有 Angular client 生成。
- `e2e` 與單元／整合測試：跨裝置歷史、來源標示、搬移、CLI 至 App 回顧、權限、無副作用驗證與重試防重。
- 本 change 先完成需求、設計與實作任務；不代表已執行 DB migration、修改執行中服務或更新外部 skill。
