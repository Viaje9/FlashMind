## Why

目前 FlashMind 的 `/speaking` 雖已具備語音流程與主要 API，但前端互動與資訊架構仍與原 SpeakUpEnglish 有明顯落差，造成使用體驗不連續。現在需要補齊 UI parity，讓使用者在遷移後維持相同操作心智與效率。

## What Changes

- 對齊 `/speaking` 主頁的錄音控制區、訊息泡泡、播放互動與狀態回饋。
- 新增 speaking 頁的情境化錯誤提示與 retry UX（權限、上傳大小、播放失敗）。
- 對齊 AI 助手面板與浮動筆記面板（可開關、可拖曳、可調高度、可清空）。
- 對齊 `/speaking/history` 的列表/詳情/繼續對話流程與刪除確認互動。
- 對齊 `/settings/speaking` 的未儲存變更保護、重設流程與 voice preview 互動細節。
- 補齊 speaking 頁視覺語彙（動畫、錄音 pulse、播放中狀態、版面節奏）。

## Capabilities

### New Capabilities

- `speaking-ui-parity`: 定義 speaking 前端介面與互動流程需與 SpeakUpEnglish 對齊的要求（主頁、歷史、設定、助手、筆記）。

### Modified Capabilities

- `audio-playback`: speaking 頁播放行為需補齊 iOS/PWA 的穩定播放策略與播放狀態回饋。

## Impact

- Affected code:
  - `apps/web/src/app/pages/speaking/*`
  - `apps/web/src/app/pages/speaking-history/*`
  - `apps/web/src/app/pages/settings/speaking/*`
  - `apps/web/src/app/components/speaking/*`
- Affected APIs: 無新增後端端點；沿用既有 speaking API。
- Dependencies/Systems:
  - 需參考 `/Users/brian/Documents/SideProject/MVP/SpeakUpEnglish/src/client/*` 的互動基準。
  - 可能新增前端播放/拖曳/動畫相關 utility 與樣式變數。
