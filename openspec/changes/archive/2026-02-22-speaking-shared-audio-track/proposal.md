## Why

iOS Safari/PWA 在非使用者手勢時常阻擋音訊播放，導致口說練習需要反覆手動點擊播放。隨著口說對話與 AI 助手發音流程加深，現有每次建立新播放器的策略在行動端穩定性不足，需改為更穩定的共享音軌模式。

## What Changes

- 將 `/speaking` 內的語音播放（主對話語音與 AI 助手片段發音）統一到同一條長壽命音軌。
- 調整播放初始化時機：使用者按下錄音鍵時即啟用共享音軌並完成解鎖。
- 錄音中與等待回應中改為「靜音（mute）」而非暫停（pause），保持音軌持續運作。
- 保留現有播放控制行為（播放/暫停、錯誤提示、重試），並確保口說頁外功能不受共享音軌 keep-alive 影響。

## Capabilities

### New Capabilities

- 無

### Modified Capabilities

- `audio-playback`: 調整口說頁音訊播放策略為共享音軌與靜音控制，強化 iOS 自動播放穩定性與跨區塊一致性。

## Impact

- 前端口說播放器服務：`apps/web/src/app/components/speaking/speaking-audio-player.service.ts`
- 口說頁互動與生命週期控制：`apps/web/src/app/pages/speaking/speaking.component.ts`
- 口說 store 對播放器控制介面：`apps/web/src/app/components/speaking/speaking.store.ts`
- AI 助手片段發音播放路徑：`apps/web/src/app/components/tts/tts.store.ts`
- 相關單元測試：`apps/web/src/app/components/speaking/speaking-audio-player.service.spec.ts`、`apps/web/src/app/pages/speaking/speaking.component.spec.ts`
