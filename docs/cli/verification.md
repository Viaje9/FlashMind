# Speaking 歷史與 CLI 驗收紀錄

日期：2026-08-30。測試使用 `speaking_cli_test`，未使用使用者學習資料。

## 已完成的驗證

- API 全套非 DB 測試：319 項通過；19 項隔離 PostgreSQL 測試另行執行並通過。
- Speaking 前端 Domain／Store／頁面／播放／翻譯：79 項通過。
- 共用 JSON／證據驗證：25 項通過；CLI 整合：6 項通過。
- 六條 E2E：瀏覽器授權與 CLI 寫回、App 同步與 Summary 重試、搬移、容量／帳號切換、CLI 真正逾時重送，以及既有選取文字翻譯 tooltip。
- AXE：CLI 授權頁、歷史明細、刪除確認對話框，WCAG 2 A／AA 與 2.1 AA 掃描通過。
- API／Web／CLI 建置通過，OpenAPI client 已同步；OpenSpec strict 與 git diff --check 通過。

## 驗證邊界

- AI 回應使用隔離測試替身，沒有呼叫真實 OpenAI，也沒有新增或修改既有 API key／模型設定。
- Chrome 使用獨立 profile 與假麥克風；尚未重新驗證實體手機、實體麥克風、真實 Realtime 品質或 Google OAuth 供應商。
- 容量清理使用測試音訊大小 metadata 達到上限，不占用數百 MB 實體儲存。
- 既有 English Study Practice／Review skills 未修改。後續新增 `apps/cli/skills` 的兩個 FlashMind 專用 skill 與全域同步 script；同步驗證見下節。
- 未建立 commit、未發布正式環境、未封存 OpenSpec。

## 重跑方式

- `pnpm --filter api test --runInBand`：API 測試，沒有隔離 DATABASE_URL 時略過資料庫案例。
- 在 `apps/api` 執行 `pnpm exec node --env-file=.env.speaking-test node_modules/jest/bin/jest.js --runInBand --testPathPatterns="(speaking-history|cli-auth).db.spec"`：19 項隔離資料庫測試。
- `pnpm --filter web test --watch=false --include="**/*speaking*.spec.ts"`：Speaking 前端測試。
- `pnpm --filter @flashmind/shared test`、`pnpm --filter @flashmind/cli test`：共用規則與 CLI。
- `pnpm test:e2e:speaking`：建置後啟動隔離 API／Web，執行六條 E2E（包含 AXE）。

## 規格場景逐項核對

| 規格                       | 場景                               | 驗證依據                                                                |
| -------------------------- | ---------------------------------- | ----------------------------------------------------------------------- |
| account-auth               | 使用者完成授權                     | CLI 授權 PostgreSQL 測試、CLI 整合測試、E2E 授權與 401／403／404        |
| account-auth               | 取消或逾時                         | CLI 授權 PostgreSQL 測試、CLI 整合測試、E2E 授權與 401／403／404        |
| account-auth               | 他人只取得公開授權連結             | CLI 授權 PostgreSQL 測試、CLI 整合測試、E2E 授權與 401／403／404        |
| account-auth               | 重複兌換或授權已過期               | CLI 授權 PostgreSQL 測試、CLI 整合測試、E2E 授權與 401／403／404        |
| account-auth               | CLI session 過期或撤銷             | CLI 授權 PostgreSQL 測試、CLI 整合測試、E2E 授權與 401／403／404        |
| account-auth               | 帳號不在白名單                     | CLI 授權 PostgreSQL 測試、CLI 整合測試、E2E 授權與 401／403／404        |
| flashmind-cli              | 在 Agent 的工作目錄執行            | CLI 整合測試、CLI E2E、docs/cli/README.md 的 skill 操作契約             |
| flashmind-cli              | 取得 Practice 上下文               | CLI 整合測試、CLI E2E、docs/cli/README.md 的 skill 操作契約             |
| flashmind-cli              | 驗證本機檔案                       | CLI 整合測試、CLI E2E、docs/cli/README.md 的 skill 操作契約             |
| flashmind-cli              | 寫回已確認檔案                     | CLI 整合測試、CLI E2E、docs/cli/README.md 的 skill 操作契約             |
| flashmind-cli              | Review 執行完但使用者尚未要求儲存  | CLI 整合測試、CLI E2E、docs/cli/README.md 的 skill 操作契約             |
| flashmind-cli              | 格式錯誤可自行修正                 | CLI 整合測試、CLI E2E、docs/cli/README.md 的 skill 操作契約             |
| flashmind-cli              | JSON 不合法                        | CLI 整合測試、CLI E2E、docs/cli/README.md 的 skill 操作契約             |
| flashmind-cli              | 網路或 session 失敗                | CLI 整合測試、CLI E2E、docs/cli/README.md 的 skill 操作契約             |
| flashmind-cli              | 使用不同 API 環境                  | CLI 整合測試、CLI E2E、docs/cli/README.md 的 skill 操作契約             |
| speaking-history           | App 練習尚未產生摘要               | 歷史 PostgreSQL 測試、同步 Store 測試、E2E App／CLI／容量／帳號切換     |
| speaking-history           | 本機 Review 寫回成功               | 歷史 PostgreSQL 測試、同步 Store 測試、E2E App／CLI／容量／帳號切換     |
| speaking-history           | 跨裝置查看相同場次                 | 歷史 PostgreSQL 測試、同步 Store 測試、E2E App／CLI／容量／帳號切換     |
| speaking-history           | 開啟已整理的場次                   | 歷史 PostgreSQL 測試、同步 Store 測試、E2E App／CLI／容量／帳號切換     |
| speaking-history           | 補匯入較早的練習                   | 歷史 PostgreSQL 測試、同步 Store 測試、E2E App／CLI／容量／帳號切換     |
| speaking-history           | 原裝置仍有音訊                     | 歷史 PostgreSQL 測試、同步 Store 測試、E2E App／CLI／容量／帳號切換     |
| speaking-history           | 另一個裝置或本機音訊已清除         | 歷史 PostgreSQL 測試、同步 Store 測試、E2E App／CLI／容量／帳號切換     |
| speaking-history           | 本機音訊容量達上限                 | 歷史 PostgreSQL 測試、同步 Store 測試、E2E App／CLI／容量／帳號切換     |
| speaking-history           | 存取他人的歷史                     | 歷史 PostgreSQL 測試、同步 Store 測試、E2E App／CLI／容量／帳號切換     |
| speaking-history           | 切換登入帳號                       | 歷史 PostgreSQL 測試、同步 Store 測試、E2E App／CLI／容量／帳號切換     |
| speaking-history           | 寫入失敗或回應遺失                 | 歷史 PostgreSQL 測試、同步 Store 測試、E2E App／CLI／容量／帳號切換     |
| speaking-history           | 使用者刪除一場歷史                 | 歷史 PostgreSQL 測試、同步 Store 測試、E2E App／CLI／容量／帳號切換     |
| speaking-history           | 在 App 延續本機已整理紀錄          | 歷史 PostgreSQL 測試、同步 Store 測試、E2E App／CLI／容量／帳號切換     |
| speaking-history-migration | 舊資料缺少帳號欄位                 | 搬移 Store／Domain／PostgreSQL 測試、E2E 回應中斷與原音保留             |
| speaking-history-migration | 舊 Summary 只有文字                | 搬移 Store／Domain／PostgreSQL 測試、E2E 回應中斷與原音保留             |
| speaking-history-migration | 舊訊息只有音訊                     | 搬移 Store／Domain／PostgreSQL 測試、E2E 回應中斷與原音保留             |
| speaking-history-migration | 搬移途中斷線                       | 搬移 Store／Domain／PostgreSQL 測試、E2E 回應中斷與原音保留             |
| speaking-history-migration | 搬移遇到內容衝突                   | 搬移 Store／Domain／PostgreSQL 測試、E2E 回應中斷與原音保留             |
| speaking-history-migration | 搬移成功並重新開啟                 | 搬移 Store／Domain／PostgreSQL 測試、E2E 回應中斷與原音保留             |
| speaking-history-migration | 後端已有更新的練習計畫             | 搬移 Store／Domain／PostgreSQL 測試、E2E 回應中斷與原音保留             |
| speaking-practice-context  | 取得四種狀態的單字                 | context PostgreSQL 測試、CLI 完整性檢查、E2E context 與新練習           |
| speaking-practice-context  | 沒有歷史或目標單字                 | context PostgreSQL 測試、CLI 完整性檢查、E2E context 與新練習           |
| speaking-practice-context  | 讀取時資料變動或回應不完整         | context PostgreSQL 測試、CLI 完整性檢查、E2E context 與新練習           |
| speaking-practice-context  | 本機較新的 Review 已寫回           | context PostgreSQL 測試、CLI 完整性檢查、E2E context 與新練習           |
| speaking-practice-context  | Review 獨立執行                    | context PostgreSQL 測試、CLI 完整性檢查、E2E context 與新練習           |
| speaking-review-recording  | 草稿涵蓋完整練習                   | 共用驗證測試、Review PostgreSQL 交易測試、Summary Service、CLI 逾時 E2E |
| speaking-review-recording  | 範圍或來源內容不足                 | 共用驗證測試、Review PostgreSQL 交易測試、Summary Service、CLI 逾時 E2E |
| speaking-review-recording  | 草稿驗證通過                       | 共用驗證測試、Review PostgreSQL 交易測試、Summary Service、CLI 逾時 E2E |
| speaking-review-recording  | 草稿含有不存在或他人的目標單字     | 共用驗證測試、Review PostgreSQL 交易測試、Summary Service、CLI 逾時 E2E |
| speaking-review-recording  | 助理說過但使用者沒用過             | 共用驗證測試、Review PostgreSQL 交易測試、Summary Service、CLI 逾時 E2E |
| speaking-review-recording  | 不確定的字形對應                   | 共用驗證測試、Review PostgreSQL 交易測試、Summary Service、CLI 逾時 E2E |
| speaking-review-recording  | 使用者修正草稿                     | 共用驗證測試、Review PostgreSQL 交易測試、Summary Service、CLI 逾時 E2E |
| speaking-review-recording  | 驗證後切換帳號或目標字表改變       | 共用驗證測試、Review PostgreSQL 交易測試、Summary Service、CLI 逾時 E2E |
| speaking-review-recording  | 單字更新途中失敗                   | 共用驗證測試、Review PostgreSQL 交易測試、Summary Service、CLI 逾時 E2E |
| speaking-review-recording  | 寫入成功但 CLI 沒收到回應          | 共用驗證測試、Review PostgreSQL 交易測試、Summary Service、CLI 逾時 E2E |
| speaking-review-recording  | 相同對話用新的隨機 request ID 重送 | 共用驗證測試、Review PostgreSQL 交易測試、Summary Service、CLI 逾時 E2E |
| speaking-review-recording  | 待接觸的字直接被使用               | 共用驗證測試、Review PostgreSQL 交易測試、Summary Service、CLI 逾時 E2E |
| speaking-review-recording  | 已加入牌組的字再次使用             | 共用驗證測試、Review PostgreSQL 交易測試、Summary Service、CLI 逾時 E2E |
| speaking-review-recording  | 補匯入過去的使用紀錄               | 共用驗證測試、Review PostgreSQL 交易測試、Summary Service、CLI 逾時 E2E |
| speaking-review-recording  | Review 保存後查看候選              | 共用驗證測試、Review PostgreSQL 交易測試、Summary Service、CLI 逾時 E2E |
| speaking-review-recording  | App 分析成功但保存失敗             | 共用驗證測試、Review PostgreSQL 交易測試、Summary Service、CLI 逾時 E2E |

共核對 56 個場景。Skill 的人工 review／明確儲存邊界由整合文件規範；CLI 不自動執行外部 skill，也不在 validate 後自行 save。

## 本機 migration 紀錄

建置隔離測試環境時，第一次環境檔建立失敗，後續 migration 指令曾回退到既有設定，將本次新增結構套用到本機 `public`。已立即告知使用者；只新增資料表及 nullable 時間欄位，未改寫既有學習紀錄或次數，未做破壞性回滾。後續所有資料庫與 E2E 寫入都有 `speaking_cli_test` schema 防護。

## 後續：本機 skill 打包與同步

`apps/cli/test/skills-sync.test.cjs` 驗證 dry-run 零寫入、同名衝突時不部分更新、拒絕 symlink／來源目錄、更新受管理 skill、保留其他 skill，以及從含空白的 repo 外目錄執行已安裝入口。這些測試不連 API、不讀取憑證、不執行 Review save。

CLI 建置及完整 10 項測試（既有 6 項加同步 4 項）通過。已同步到本機 `~/.codex/skills/flashmind-practice` 與 `flashmind-review`，並從 `/private/tmp` 執行兩個全域入口的 help；Markdown 與 repo 一致，既有兩個 English Study skill 的檔案指紋在同步前後完全相同。

Skill 另以 skill-creator 的 quick_validate 檢查命名與 frontmatter，參考草稿以正式共用驗證器核對。完整的真實英文對話品質與 Agent 是否遵守人工確認，仍需實際使用觀察；腳本測試不等同模型行為驗收。
