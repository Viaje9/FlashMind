## 1. Speaking 主頁與錄音控制

- [x] 1.1 重構 `/speaking` 錄音控制區為中心麥克風布局（idle/recording/paused/stopped/sending/retry）
- [x] 1.2 新增錄音中動態回饋（pulse、計時）與可預期的按鈕狀態切換
- [x] 1.3 對齊錯誤提示文案與 retry UX（權限/非 HTTPS/413/播放失敗）

## 2. 訊息泡泡與播放互動

- [x] 2.1 重構 speaking 訊息泡泡（user 語音樣式、assistant avatar 樣式、summary 區塊）
- [x] 2.2 補齊 assistant 播放中狀態回饋與手動播放入口
- [x] 2.3 補齊翻譯切換互動（翻譯中/顯示翻譯/切回原文）

## 3. Audio Playback 穩定性（iOS/PWA）

- [x] 3.1 在 speaking 播放流程加入 unlock 與 autoplay fallback 策略
- [x] 3.2 實作 visibility-aware retry（頁面可見性恢復後重試播放）
- [x] 3.3 整理播放/解碼快取與錯誤回復流程，避免重複請求與卡死狀態

## 4. AI 助手與浮動筆記面板

- [x] 4.1 對齊 AI 助手面板 UI（可開關、可清空、訊息列表與輸入區）
- [x] 4.2 新增筆記浮動面板（可開關、可拖曳、可調高度）
- [x] 4.3 保存面板位置與高度至本機儲存，重整後可還原

## 5. History 與 Settings parity

- [x] 5.1 重構 `/speaking/history` 為列表 + 詳情雙層流程
- [x] 5.2 新增歷史刪除確認互動與繼續對話入口
- [x] 5.3 對齊 `/settings/speaking` 草稿模式、dirty-check、放棄未儲存變更提示
- [x] 5.4 新增設定重設流程並保留 voice preview 互動一致性

## 6. 驗證與回歸

- [x] 6.1 新增/更新 speaking 相關 domain 與互動測試（含播放 fallback 情境）
- [x] 6.2 執行 `pnpm --filter ./apps/web build` 與必要測試，確認無回歸
- [x] 6.3 手動驗證行動裝置流程（錄音、播放、history、settings、助手、筆記）
