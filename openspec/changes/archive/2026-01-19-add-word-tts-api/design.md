# Design: 單字 TTS API

## Context

FlashMind 卡片編輯器有兩個 TTS 播放情境：
1. **卡片正面**（單字）：朗讀單一英文單字或短片語
2. **例句**：朗讀完整英文句子

目前兩者都使用 Azure Speech Services，但 Azure 按字元計費。單字朗讀頻率高但內容短，適合改用免費的 Google Translate TTS。

## Goals / Non-Goals

**Goals:**
- 單字使用 Google Translate TTS（免費）
- 句子繼續使用 Azure TTS（高品質）
- 前端明確區分兩種播放方式

**Non-Goals:**
- 不支援多語言（固定 EN）
- 不做智慧判斷（由前端明確指定）
- 不快取 Google TTS 結果到檔案系統

## Decisions

### 1. API 設計：兩支獨立 API

```
POST /tts/word       → Google Translate TTS（單字）
POST /tts/synthesize → Azure TTS（句子，現有）
```

**理由**：明確分離責任，前端可根據使用情境選擇適當 API。

**替代方案**：單一 API + `type` 參數
- 優點：API 數量少
- 缺點：後端邏輯耦合，未來擴展不便
- 結論：不採用

### 2. Google Translate TTS 實作方式

後端作為 Proxy 呼叫 Google Translate TTS：

```
前端 → POST /tts/word → 後端 Proxy → Google Translate TTS
```

**理由**：
- 避免 CORS 問題
- 統一錯誤處理
- 可加入 rate limiting
- 保持 API 一致性（前端只呼叫自家後端）

**Google TTS URL 格式**：
```
https://translate.google.com/translate_tts?ie=UTF-8&total=1&idx=0&textlen={len}&client=tw-ob&q={text}&tl=en
```

### 3. 前端 TtsStore 擴展

```typescript
// 現有方法（句子）
play(text: string): Promise<void>

// 新增方法（單字）
playWord(text: string): Promise<void>
```

兩者共用快取機制，但 cache key 加上 prefix 區分來源。

## Risks / Trade-offs

| 風險 | 說明 | 緩解措施 |
|------|------|----------|
| Google TTS 非官方 API | 可能被封鎖或更改 | 監控錯誤率，必要時 fallback 到 Azure |
| Rate limiting | Google 可能限制請求頻率 | 前端快取 + 後端可加 rate limiter |

## Open Questions

無（需求已明確）
