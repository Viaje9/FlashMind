## Context

目前口說頁同時存在兩條播放路徑：主對話語音（`SpeakingAudioPlayerService`）與 AI 助手片段發音（`TtsStore` 自行建立 `Audio`）。在 iOS Safari/PWA 下，這種「每次新建播放器」模式容易再次碰到 autoplay gate，導致使用者需要重複手動點擊播放。

本次變更需在不改 API 契約的前提下，提升 `/speaking` 的播放穩定性，同時維持既有的按鈕狀態與錯誤提示行為。

## Goals / Non-Goals

**Goals:**

- 將 `/speaking` 內所有語音播放統一到同一條長壽命音軌。
- 在按下錄音時先啟用共享音軌，讓後續播放沿用已解鎖音軌。
- 在錄音中與等待回應中使用 `mute` 控制，避免中斷音軌生命週期。
- 限制共享音軌 keep-alive 僅作用於口說頁，避免影響其他頁面的播放行為。

**Non-Goals:**

- 不調整後端語音 API 與回傳格式。
- 不改變口說頁外（例如卡片編輯、學習頁）的產品規格。
- 不在本次導入多音軌混音或 queue 播放系統。

## Decisions

### 1. 口說頁採單一共享音軌（Single Long-Lived Audio Element）

**Decision:** 將 `SpeakingAudioPlayerService` 改為維護單一 `HTMLAudioElement`，所有 `/speaking` 播放來源（主對話與 AI 助手片段）共用該實例。

**Alternatives considered:**

- 維持現行每段音訊建立新 `Audio`：實作簡單，但 iOS 穩定性不足。
- 以 Web Audio Graph 完整重構：彈性高，但複雜度與回歸風險過高。

**Rationale:** 共享單一音軌是最低改動且能直接改善 iOS autoplay gate 的方案。

### 2. 錄音按下即啟動共享音軌，並以 keep-alive 維持

**Decision:** 在 `onStartRecording()` 前先呼叫 `activateSharedAudioTrack()`；共享模式下使用靜音短音檔 loop 作 keep-alive，確保下一段語音可沿用同一音軌。

**Alternatives considered:**

- 只在收到回應時才啟動音軌：仍可能落在非手勢時機而被阻擋。

**Rationale:** 將初始化綁在明確手勢（錄音按鈕）是最可預期的 iOS 解法。

### 3. 錄音/送出期間改採靜音，不暫停音軌

**Decision:** 口說頁依 `recording | paused | sending | stoppingAndSending` 狀態切換 `setMuted(true/false)`，不主動 pause 共用音軌。

**Alternatives considered:**

- 直接 pause：實作直覺，但容易丟失已解鎖播放上下文。

**Rationale:** 保持音軌連續運作可降低 iOS 再次要求手勢的機率。

### 4. AI 助手片段發音改接入共享播放器

**Decision:** `TtsStore` 保留文字快取與 UI 狀態管理，但實際播放委派給 `SpeakingAudioPlayerService`。

**Alternatives considered:**

- 口說頁分叉一份 TTS store：可降低耦合，但重複邏輯過多。

**Rationale:** 重用既有播放器可確保「同一音軌」規格成立，並維持最小變動。

## Risks / Trade-offs

- **[共享播放器跨模組耦合上升]** → 透過 `sharedTrackEnabled` 限縮 keep-alive 範圍，只在口說頁啟用。
- **[靜音狀態與 UI 不一致]** → 以 `SpeakingComponent` effect 單點收斂 mute 條件，避免多處判斷分歧。
- **[TtsStore 錯誤訊息污染口說全域錯誤]** → 在片段發音流程中清理播放器錯誤，讓片段發音維持局部錯誤語義。

## Migration Plan

1. 更新 OpenSpec（本 change）中的 `audio-playback` delta spec 與 tasks。
2. 調整 `SpeakingAudioPlayerService` 為共享音軌 + keep-alive + mute 控制。
3. 在 `SpeakingComponent` 新增共享音軌啟用、靜音控制與頁面離開釋放。
4. 在 `TtsStore` 將片段發音改接共享播放器。
5. 補齊播放器單元測試，確認共享實例重用與靜音行為。

**Rollback:**

- 回退至舊版播放器策略（每次建立新 `Audio`）即可，不涉及資料遷移與 DB 變更。

## Open Questions

- 是否需要將「共享音軌已啟用」狀態顯示於 UI（供除錯與客服判斷）？
- 是否要在未先錄音就觸發播放時，自動補啟動共享音軌（目前保留既有 fallback 行為）？
