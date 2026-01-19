# Change: 優化 AI 卡片內容生成 Prompt

## Why

目前 AI 生成的詞義缺少詞性標註，使用者需要自行判斷或補充詞性資訊。加入詞性標註可以提升學習效果，讓使用者更清楚理解單字的用法。

## What Changes

- 修改 AI Prompt 的 system message，要求 AI 在中文解釋後附加詞性標註
- 詞性格式統一為：`中文解釋 (詞性縮寫)`，例如 `你好 (感嘆詞)` 或 `走路 (v.)`
- 保持現有 API Response 結構不變（`meanings` 陣列，每個元素有 `zhMeaning`、`enExample`、`zhExample`）

## Impact

- Affected specs: `ai-generation`
- Affected code: `apps/api/src/modules/ai/ai.service.ts` (buildPrompt 方法)
