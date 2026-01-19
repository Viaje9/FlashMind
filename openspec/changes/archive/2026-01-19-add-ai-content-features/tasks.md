# Implementation Tasks

## 1. OpenAPI 規格

- [x] 1.1 新增 `POST /ai/generate-card-content` 端點定義
- [x] 1.2 新增 `POST /tts/synthesize` 端點定義
- [x] 1.3 新增對應的 Request/Response schemas
- [x] 1.4 執行 `pnpm generate:api` 產生 API client

## 2. 後端 - AI 生成模組（TDD）

- [x] 2.1 建立 `ai` module 結構（`apps/api/src/modules/ai/`）
- [x] 2.2 新增環境變數 `OPENAI_API_KEY` 設定
- [x] 2.3 撰寫 `AiService.generateCardContent()` 單元測試
- [x] 2.4 實作 `AiService.generateCardContent()` 通過測試
- [x] 2.5 撰寫 AI 生成的 prompt template
- [x] 2.6 撰寫 `AiController` 單元測試
- [x] 2.7 實作 `AiController` 處理 `POST /ai/generate-card-content`

## 3. 後端 - TTS 模組（TDD）

- [x] 3.1 建立 `tts` module 結構（`apps/api/src/modules/tts/`）
- [x] 3.2 新增環境變數 `AZURE_SPEECH_KEY`、`AZURE_SPEECH_REGION`
- [x] 3.3 撰寫 `TtsService.synthesize()` 單元測試
- [x] 3.4 實作 `TtsService.synthesize()` 通過測試
- [x] 3.5 撰寫 `TtsController` 單元測試
- [x] 3.6 實作 `TtsController` 處理 `POST /tts/synthesize`

## 4. 前端 - AI 生成功能（TDD）

- [x] 4.1 撰寫 `ai.domain.ts` 單元測試
- [x] 4.2 實作 `ai.domain.ts` 通過測試
- [x] 4.3 建立 `AiStore`（呼叫 API client）
- [x] 4.4 在 CardEditor 新增「AI 生成」按鈕
- [x] 4.5 實作生成流程（載入狀態、錯誤處理）
- [x] 4.6 生成結果自動填入詞義欄位

## 5. 前端 - 語音播放功能（TDD）

- [x] 5.1 撰寫 `tts.domain.ts` 單元測試
- [x] 5.2 實作 `tts.domain.ts` 通過測試
- [x] 5.3 建立 `TtsStore`（呼叫 API client + 音訊播放）
- [x] 5.4 實作音訊快取機制
- [x] 5.5 在 CardEditor 英文例句旁新增播放按鈕
- [x] 5.6 在正面文字區域新增播放按鈕
- [x] 5.7 實作播放狀態（載入中、播放中）

## 6. 文件與驗收

- [x] 6.1 更新環境變數範例（`apps/api/.env.example`）
- [x] 6.2 驗收所有 User Stories
