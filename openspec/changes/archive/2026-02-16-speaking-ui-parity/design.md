## Context

FlashMind 已完成 speaking 的 API 與基本前端流程，但目前 UI 互動密度、狀態回饋、頁面節奏與舊版 SpeakUpEnglish 不一致。這次變更僅針對前端介面與互動 parity，不新增後端端點，也不改 OpenAPI 契約。

受影響範圍橫跨 speaking 主頁、history、settings、assistant panel 與播放控制，屬於跨頁面的體驗重構。

## Goals / Non-Goals

**Goals:**

- 對齊 `/speaking` 的錄音控制語彙（中心麥克風、錄音中 pulse、暫停/取消/停止布局）。
- 對齊訊息泡泡與播放交互（AI avatar 播放狀態、user 語音膠囊、翻譯切換）。
- 對齊 AI 助手面板與浮動筆記（開關、拖曳、調整高度、狀態保存）。
- 對齊 `/speaking/history` 的列表與詳情互動（繼續對話、刪除確認、摘要複製）。
- 對齊 `/settings/speaking` 的未儲存變更保護、重設設定與 voice preview 細節。
- 補齊 iOS/PWA 音訊播放穩定策略（unlock、retry、visibility-aware）。

**Non-Goals:**

- 新增或變更 speaking 後端 API。
- 導入後端 conversation/message 儲存。
- 覆寫 FlashMind 全站設計系統；僅限 speaking 區域。

## Decisions

1. **採用「體驗等價」而非像素級複製**

- Decision: 保留 FlashMind header/navigation 元件結構，對齊互動流程與資訊層級。
- Why: 可降低與既有 UI 系統衝突，同時滿足使用者遷移體驗。
- Alternative: 全量複製舊版 UI；缺點是破壞現有設計一致性。

2. **重構 speaking 頁為狀態機導向 UI**

- Decision: 將錄音與送出流程切為 `idle/recording/paused/stopped/sending/retry` 可視狀態。
- Why: 可避免分散條件判斷，確保按鈕可預期切換。
- Alternative: 以分散旗標判斷顯示；缺點是維護成本高、易出現互斥錯誤。

3. **播放策略採雙層 fallback**

- Decision: 保留目前 audio player service，新增/補齊 unlock + retry + visibility-aware 自動播放。
- Why: iOS 與 PWA 對 autoplay 限制嚴格，需顯式解鎖與重試。
- Alternative: 僅使用原生 `Audio.play()`；缺點是首播失敗率高。

4. **助手與筆記採浮動面板共通交互模型**

- Decision: AI 助手與小抄筆記都採可拖曳、可調高、可持久化位置/高度。
- Why: 避免遮擋主流程並維持單手操作效率。
- Alternative: 固定底部抽屜；缺點是與錄音區衝突、資訊密度下降。

5. **設定頁採 explicit save 與 dirty-check**

- Decision: speaking 設定頁改為草稿態，離開前檢查未儲存變更。
- Why: 避免誤觸返回導致設定遺失。
- Alternative: 即時寫入 localStorage；缺點是不可逆、難以放棄修改。

## Risks / Trade-offs

- [拖曳/resize 互動在行動裝置易誤觸] → 使用 drag handle、排除輸入元件、限制邊界。
- [新增動畫造成低階裝置效能壓力] → 動畫僅用 transform/opacity，避免重排。
- [播放重試策略增加程式複雜度] → 將播放策略封裝在獨立 service/util，不滲透頁面元件。
- [Parity 範圍擴大導致交付延後] → 分階段交付：主頁 > history > settings > 面板增強。

## Migration Plan

1. 新增 speaking parity 專用 domain/view-model 與 UI 子元件（RecorderBar、MessageBubble、FloatingPanel）。
2. 先替換 `/speaking` 主頁互動與播放狀態，保持 API/store 相容。
3. 補齊 `/speaking/history` 詳情與操作流程。
4. 補齊 `/settings/speaking` 的草稿態與放棄提示。
5. 引入助手/筆記浮動面板拖曳與尺寸持久化。
6. 回歸驗證：`pnpm --filter ./apps/web build` + speaking 相關測試。

Rollback:

- 保留舊 speaking component 的可回退 commit；若互動回歸失敗，先切回簡化版 UI 並保留資料層。

## Open Questions

- 浮動筆記面板是否需跨裝置同步（目前預設 localStorage）？
- 成本顯示條（tokens/USD/TWD）是否納入 parity 第一階段？
- AI 助手面板是否需要與主對話共享 memory context？
