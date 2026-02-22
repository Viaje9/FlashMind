## Context

目前 `/speaking` 已有「整則訊息翻譯」按鈕，透過 `translateSpeakingText` 呼叫 `/speaking/translate` 並把翻譯結果存回訊息。這次需求是將翻譯入口下沉到「選取文字片段」層級，並且在 iOS PWA 以自訂操作取代或優先於原生選取選單。

主要限制如下：

- 專案為 Angular PWA，需兼顧 iOS Safari 與 iOS standalone（加入主畫面）差異。
- 既有 API 已提供 `POST /speaking/translate`，可直接翻譯任意文字（1-4000 字）。
- 口說訊息目前已有翻譯顯示狀態，新增互動不得破壞既有整則翻譯流程。

## Goals / Non-Goals

**Goals:**

- 在 AI assistant 訊息中，使用者選取文字後可看到「翻譯」操作。
- 點擊「翻譯」後以 tooltip 顯示 loading、結果、錯誤與重試能力。
- iOS PWA 優先顯示產品自訂操作，不依賴原生選單才能完成翻譯。
- 不新增後端端點，沿用既有 speaking translate API。

**Non-Goals:**

- 不重做整個 speaking 對話 UI/樣式系統。
- 不新增多語系翻譯目標（仍以繁中為目標）。
- 不改變既有「整則訊息翻譯」按鈕的可用性與資料模型。

## Decisions

1. 互動邊界只限 assistant 訊息逐字稿

- Decision: 僅對 `role=assistant` 的文字內容啟用選取翻譯；`role=user` 語音膠囊不啟用。
- Rationale: 與使用情境一致，避免語音膠囊/控制按鈕誤觸。
- Alternative considered: 全訊息區都可選取；會造成 UI 控件文字被誤選，交互噪音較高。

2. iOS PWA 選單覆蓋採「攔截原生選單 + 自訂浮動操作」

- Decision: 在 iOS standalone 模式下對 assistant 文字區域攔截 `contextmenu`，並以 Selection API 偵測非空選取，顯示唯一主操作「翻譯」。
- Rationale: 可在不重建文本渲染器的前提下滿足「選取即有翻譯入口」。
- Alternative considered: 自製字詞級選取引擎（token range）；實作成本與回歸風險過高。

3. Tooltip 狀態機採 request-token 防止競態

- Decision: tooltip 有 `idle/loading/success/error` 四態，翻譯請求附帶本地 request token；若選取範圍改變，舊回應丟棄。
- Rationale: 避免快速重新選取導致舊翻譯覆蓋新選取內容。
- Alternative considered: 僅用單一 loading flag；無法可靠處理競態。

4. API 與快取策略沿用現有 translate 能力

- Decision: 呼叫 `translateSpeakingText`，請求內容改為「選取片段」；以 `messageId + selectedText` 作前端快取鍵。
- Rationale: 降低重複請求與等待時間，不需擴充 OpenAPI。
- Alternative considered: 每次都打 API；行動網路下體感延遲較高。

5. 非 iOS 或無法抑制原生選單時的降級

- Decision: 保留自訂「翻譯」入口，若裝置限制無法完全隱藏原生選單，不阻斷選取與翻譯流程。
- Rationale: Web 平台差異大，功能可用性優先於視覺一致性。
- Alternative considered: 嚴格要求完全覆蓋才提供功能；會造成部分裝置無法使用。

## Risks / Trade-offs

- [iOS 版本差異造成原生選單仍偶發顯示] → 以「功能可用」為驗收基準，加入裝置矩陣測試與 fallback 說明。
- [tooltip 定位在小螢幕易遮擋文字] → 加入 viewport 邊界修正與上下翻轉策略。
- [頻繁選取造成 API 請求尖峰] → 增加同片段快取與最小觸發長度（>=1，並遵守 API 4000 上限）。
- [新選取互動干擾既有按鈕點擊] → 只在文字節點發生選取時顯示操作，並在失焦/清除選取時立即收合。

## Migration Plan

1. 先在 `apps/web` 新增選取監聽與 tooltip 元件/狀態，不動後端。
2. 將翻譯呼叫接到既有 `translateSpeakingText`，並補齊快取與競態保護。
3. 補元件測試（選取、翻譯成功/失敗、競態）與 iOS 導向 E2E。
4. 驗證通過後直接上線；若需回滾，可移除選取入口並保留既有整則翻譯按鈕，不影響資料。

## Open Questions

- iOS standalone 下「完全不顯示原生選單」是否作為硬性驗收，或接受少數版本 fallback（仍可點自訂翻譯）？
- tooltip 是否需要提供「複製翻譯」第二操作，或首版只保留結果顯示與關閉？
