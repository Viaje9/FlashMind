## Why

目前口說頁的 AI 助手訊息沒有「選取片段後快速聽發音」能力，使用者需要手動複製文字再切換操作，會中斷練習節奏。尤其在 iOS PWA 情境下，原生選取選單可控性較差，更需要一致、可預期的自訂選取互動來直接播放發音。

## What Changes

- 在口說頁 AI 助手面板中，新增 assistant 訊息文字的選取互動入口。
- 支援 iOS standalone PWA 的自訂選取模式，並在非 iOS 情境支援一般文字選取。
- 將選取後的互動定義為「按鈕直接播放發音」而非翻譯 tooltip，按鈕需呈現 loading、播放/暫停與重試狀態。
- 片段發音播放整合既有語音播放能力與快取策略，避免重複請求造成延遲。
- 不變更既有「主口說對話區」的選取翻譯功能。

## Capabilities

### New Capabilities

- `assistant-selection-pronunciation`: 在 AI 助手訊息中提供選取文字後播放發音的完整互動流程與狀態呈現。

### Modified Capabilities

- `audio-playback`: 擴充前端語音播放需求，支援由選取文字片段觸發 TTS 播放與錯誤重試流程。

## Impact

- Affected specs:
  - `openspec/changes/assistant-selection-pronunciation/specs/assistant-selection-pronunciation/spec.md`（新增）
  - `openspec/changes/assistant-selection-pronunciation/specs/audio-playback/spec.md`（修改）
- Affected frontend code:
  - `apps/web/src/app/pages/speaking/speaking.component.ts`
  - `apps/web/src/app/pages/speaking/speaking.component.html`
  - `apps/web/src/app/pages/speaking/speaking.component.css`
  - `apps/web/src/app/components/speaking/*`（選取與播放相關 store/service）
- Test impact:
  - `apps/web/src/app/pages/speaking/speaking.component.spec.ts` 新增選取與發音互動測試
  - 視需求補充 E2E（iOS-like 互動與回歸）
- API impact:
  - 優先重用現有語音播放 API；若現有介面不足再另提 API 變更（本 change 預設不新增公開 endpoint）
