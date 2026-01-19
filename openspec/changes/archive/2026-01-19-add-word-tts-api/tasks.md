# Tasks: 新增單字 TTS API

## 1. 後端實作

- [x] 1.1 在 `openapi/api.yaml` 新增 `POST /tts/word` 端點定義
- [x] 1.2 執行 `pnpm generate:api` 產生 API Client
- [x] 1.3 在 `tts.service.ts` 新增 `synthesizeWord()` 方法（呼叫 Google Translate TTS）
- [x] 1.4 在 `tts.controller.ts` 新增 `/word` 路由
- [x] 1.5 撰寫單元測試

## 2. 前端實作

- [x] 2.1 在 `tts.domain.ts` 新增 `createWordAudioCacheKey()` 函式
- [x] 2.2 在 `tts.store.ts` 新增 `playWord()` 方法
- [x] 2.3 撰寫 domain 單元測試

## 3. 整合卡片編輯器

- [x] 3.1 修改 `card-editor.component.ts` 的 `onPlayAudio()` 邏輯
  - 卡片正面：呼叫 `playWord()`
  - 例句：呼叫 `play()`
- [x] 3.2 更新 `card-editor.component.html` 傳入適當參數

## 4. 驗收

- [x] 4.1 手動測試：卡片正面播放使用 Google TTS
- [x] 4.2 手動測試：例句播放使用 Azure TTS
- [x] 4.3 確認快取機制正常運作
