## Why

FlashMind 目前缺少能持續進行文字英文對話、同時保留學習回饋與歷史紀錄的獨立模式。新增主題對話後，使用者可以直接以英文回應 AI，在不中斷對話的情況下取得文法修正，並持續練習不重複的新情境。

## What Changes

- 新增與 Decks、Speaking、收藏包並列的「主題對話」學習入口。
- AI 建立盡量不與使用者歷史重複的主題，並主動傳送第一則英文訊息。
- 使用者自由輸入英文；每次送出後，系統保存原句、提供精簡文法／自然度修正，並由 AI 延續正常對話。
- 回應提示預設不顯示，只有使用者主動要求時才產生。
- 保存主題、對話場次、訊息與修正內容，支援查閱及繼續既有對話。
- 支援從歷史主題建立新的練習場次，不覆蓋原始紀錄。
- 新增 contract-first API、Prisma 資料模型、generated API client 與對應測試。

## Capabilities

### New Capabilities

- `topic-conversation-practice`: 涵蓋新主題產生與去重、文字對話、文法修正、按需提示、歷史查閱、繼續對話及重複練習既有主題。

### Modified Capabilities

無。

## Impact

- `openapi/api.yaml` 與 `packages/api-client`：新增主題對話契約與產生的 client。
- `apps/api/prisma`、`apps/api/src/modules`：新增持久化資料模型、AI provider、service 與 controller。
- `apps/web/src/app`：新增主題對話 domain/store、對話頁、歷史頁、路由及首頁入口。
- 沿用既有 `OPENAI_API_KEY` 與 OpenAI 相依套件，不新增外部服務或套件。
