## Context

FlashMind 需要整合外部 AI 服務來提供內容生成與語音合成功能。這涉及：
- 與 OpenAI API 整合（GPT 模型）
- 與 Azure Speech Services 整合（TTS）
- API Key 安全管理
- 前後端架構設計

## Goals / Non-Goals

**Goals**:
- 透過後端代理保護 API Keys
- 提供流暢的 AI 生成體驗（載入狀態、錯誤處理）
- 支援英文例句的語音播放
- 可編輯 AI 生成的內容

**Non-Goals**:
- 多語言 TTS 支援（目前僅英文）
- AI 生成的用量計費系統
- 語音播放的離線快取

## Decisions

### 1. 後端代理模式

**Decision**: 所有 AI/TTS 請求經由後端轉發，API Keys 存放於後端環境變數。

**Rationale**:
- 前端不暴露敏感金鑰
- 可在後端實作速率限制、用量追蹤
- 統一錯誤處理

### 2. TTS 技術選型

**Decision**: 使用 Azure Speech Services（`en-US-AvaMultilingualNeural` 語音）

**Rationale**:
- 高品質神經網路語音
- 支援 SSML 格式，可擴展
- 用戶已有可用的 Azure 訂閱

**Implementation**:
```typescript
// SSML 格式
const ssml = `
  <speak version='1.0' xml:lang='en-US'>
    <voice name='en-US-AvaMultilingualNeural'>${text}</voice>
  </speak>`;

// Azure TTS Endpoint
POST https://{region}.tts.speech.microsoft.com/cognitiveservices/v1
Headers:
  Content-Type: application/ssml+xml
  X-Microsoft-OutputFormat: audio-16khz-32kbitrate-mono-mp3
  Ocp-Apim-Subscription-Key: {key}
```

### 3. AI 生成內容格式

**Decision**: 使用 OpenAI API 生成結構化的詞義與例句。

**Output Schema**:
```typescript
interface GeneratedContent {
  meanings: Array<{
    zhMeaning: string;    // 中文解釋
    enExample?: string;   // 英文例句
    zhExample?: string;   // 中文翻譯
  }>;
}
```

### 4. API 端點設計

**Decision**: 新增兩個獨立端點，不掛在現有資源路徑下。

| 端點 | 說明 |
|------|------|
| `POST /ai/generate-card-content` | AI 生成（需登入） |
| `POST /tts/synthesize` | TTS 合成（需登入） |

**Rationale**:
- 這些是獨立服務，非特定資源的子操作
- 便於未來擴展其他 AI 功能

### 5. 前端音訊快取

**Decision**: 使用記憶體快取已播放的音訊 URL。

**Implementation**:
```typescript
// 使用 Map 快取 blob URL
private audioCache = new Map<string, string>();
```

**Rationale**:
- 避免重複請求相同文字
- 頁面重新載入時自動清除

## Risks / Trade-offs

| 風險 | 緩解措施 |
|------|----------|
| AI 生成品質不佳 | 用戶可編輯/刪除生成內容；持續優化 prompt |
| AI API 成本過高 | 可考慮每日生成上限（未來） |
| TTS 延遲影響體驗 | 前端顯示載入狀態；考慮預先載入 |
| Azure Speech 區域限制 | 使用 East Asia 區域，台灣延遲較低 |

## Environment Variables

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Azure Speech
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=eastasia
```

## Open Questions

1. AI 生成是否需要設定每日上限？（暫不實作）
2. 是否需要支援多種 TTS 語音選擇？（暫不實作，使用固定語音）
