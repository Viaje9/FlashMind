## Context

目前 `/speaking` 頁面已具備「主口說對話區 assistant 逐字稿」的選取翻譯流程（含 iOS PWA 自訂選取）。
但 AI 助手面板（`assistantMessages`）目前僅顯示純文字訊息，沒有提供選取後動作。

專案內已存在可重用的語音播放能力：

- `TtsStore.play(text)`：句子語音合成與播放，含快取
- 既有選取 overlay 生命周期管理（顯示、關閉、競態保護）

限制條件：

- 本次不影響主口說對話區「選取翻譯」行為
- 需優先支援 iOS standalone PWA 的可用性
- 以最小改動導入，避免大規模重構造成回歸風險

## Goals / Non-Goals

**Goals:**

- 在 AI 助手面板中，支援 assistant 訊息選取文字後觸發「發音」動作。
- 在 iOS standalone PWA 與一般環境都可完成選取與發音流程。
- 發音互動改為按鈕內狀態（loading、播放/暫停、可重試），不再開啟發音 tooltip。
- 重用既有語音能力與快取，避免新增不必要 API。

**Non-Goals:**

- 不改變主口說對話區的選取翻譯規格。
- 不新增新的公開後端 endpoint。
- 不在本次引入多語音選擇器或逐詞高亮播放。

## Decisions

### 1. 選取互動採「同一套機制、雙場景」設計

**Decision:** 以既有選取 overlay/tooltip 邏輯為基礎，擴充為可識別兩種來源場景：

- 主口說對話區 assistant 逐字稿（既有：翻譯）
- AI 助手面板 assistant 訊息（新增：發音）

在選取 target 中加入場景資訊（例如 `context: 'main-transcript' | 'assistant-panel'`），由場景決定 action 文案與 tooltip 行為。

**Alternatives considered:**

- 完全複製一套 AI 助手專用選取系統：開發快但重複邏輯高，後續維護成本高。
- 全面重構成通用 selection framework：可擴充性高，但本次需求過大。

**Rationale:** 以最小重構達成可複用與低風險平衡。

### 2. 發音流程重用 `TtsStore.play(text)`

**Decision:** AI 助手選取發音直接呼叫 `TtsStore.play(selectedText)`，並在 selection action 按鈕上呈現狀態（`loading` / `play` / `pause` / `retry`）。

**Alternatives considered:**

- 使用 `speakingApi.previewSpeakingVoice`：可帶 speaking voice，但回傳格式與現有播放流程耦合較高。
- 新增專用 store：邏輯更乾淨，但會增加狀態同步成本。

**Rationale:** `TtsStore` 已驗證可用且具快取，能最快落地需求並降低 API 變更風險。

### 3. UI 互動定義：選取後按鈕改為「發音」，不開啟發音 tooltip

**Decision:** 在 AI 助手面板選取文字時，顯示動作按鈕「發音」；點擊後直接呼叫 API 並自動播放，不開啟發音 tooltip。

- 請求中：按鈕顯示 loading（點點點）
- 音檔回來後：自動播放，按鈕切換為「播放／暫停」
- 播放失敗：按鈕回到可重試的「發音」狀態
- 選取變更、點擊外部、視窗失焦/滾動：清除目前 selection action（沿用既有規則）

**Alternatives considered:**

- 選取後自動播放（免點擊）：操作較快，但容易誤觸與連續請求。

**Rationale:** 維持和現有選取翻譯一致的「先選取、再點動作」節奏，降低認知成本。

### 4. iOS PWA 自訂選取模式延伸到 AI 助手面板

**Decision:** 延伸既有 token-based 自訂選取流程到 AI 助手訊息 DOM，並與主對話區共用同一套選取事件生命週期。

**Alternatives considered:**

- AI 助手面板只支援一般 selection API：在 iOS PWA 成功率不穩。

**Rationale:** 需求明確以 iOS 為主，必須提供可預期互動。

### 5. 測試策略採 component 層行為驗證

**Decision:** 在 `speaking.component.spec.ts` 增加：

- AI 助手訊息選取後顯示「發音」動作
- 觸發動作後呼叫播放方法
- 播放失敗時顯示錯誤並可重試
- 選取改變時丟棄過期狀態

**Alternatives considered:**

- 僅手測：回歸風險高。

**Rationale:** 此功能高度互動、易受事件順序影響，需要自動化測試守住行為。

## Risks / Trade-offs

- **[選取邏輯複雜度上升]** → 以 `context` 明確分流，避免不同場景互相污染狀態。
- **[播放狀態與實際音訊事件不同步]** → 以 promise 結果與可觀測的播放完成事件共同收斂狀態。
- **[iOS 裝置行為差異]** → 先以既有 iOS token 模式擴充，並保留 fallback 到一般選取流程。
- **[重用 TtsStore 造成跨頁狀態耦合]** → 僅讀取必要狀態，避免在 speaking page 寫入與卡片編輯無關的共享狀態。

## Migration Plan

1. 新增/調整 OpenSpec spec（新增 `assistant-selection-pronunciation`、修改 `audio-playback`）。
2. 先在 `speaking.component` 實作 AI 助手選取來源與 action context。
3. 接入 `TtsStore.play` 與發音按鈕狀態呈現（loading / 播放 / 暫停 / 重試）。
4. 補齊 `speaking.component.spec.ts` 測試。
5. 驗證主口說對話區「選取翻譯」未回歸。

**Rollback:**

- 前端功能旗標式回退（移除 AI 助手場景分支）即可還原，不涉及資料遷移。

## Open Questions

- AI 助手選取發音是否需要跟隨「口說設定 voice」而非 TTS 預設聲線？
- 發音按鈕是否需要顯示更細的狀態文案（例如「載入中」「播放中」）以提升可理解性？
