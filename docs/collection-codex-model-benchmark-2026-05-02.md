# 收藏包 Codex 模型速度測試報告

日期：2026-05-02  
測試目標：比較收藏包聊天候選生成在不同 Codex SDK 模型設定下的延遲與輸出品質。  
測試 API 對應場景：`POST /api/collections/chat-sessions/:sessionId/messages`

## 測試結論

這次小樣本實測中，最快的是 `gpt-5.4-mini + low`，平均約 `10.19s`。

`gpt-5.5 + low` 平均約 `10.75s`，品質穩定，但沒有明顯比 mini 快。

`gpt-5.5 + fast + low` 這次可以成功執行，代表目前帳號 / Codex OAuth 環境可用 fast mode；但兩次結果平均約 `11.85s`，沒有比標準模式快。這可能是樣本數太少、服務端波動、fast mode 啟用成本、或該任務本身 structured output / agent turn overhead 仍占大頭。

若目標是降低目前 20 幾秒等待，建議第一步改測：

1. `gpt-5.4-mini + low` 作為主要候選。
2. 再加測 `gpt-5.4-mini + minimal`。
3. 不建議先把預設改成 `gpt-5.5 fast`，因為這次沒有看到速度收益，成本還更高。

## 測試設定

測試輸入：

```text
我想比較價格並找到好優惠
```

測試資料：

- userId：`cml3irbgt0000ua3jmj9snqd7`
- sessionId：`cmoofdhxt0009sruazjz96zmn`
- 單字卡數量：約 1000
- 收藏數量：0
- 使用正式 `CollectionToolService`
- 使用正式 `CodexCollectionAiProvider` prompt 與 structured output schema
- 每組跑 2 次
- 每次都使用新 thread，避免 thread history 影響比較

相關 source cards：

| id                          | word    | meaning         |
| --------------------------- | ------- | --------------- |
| `cml3j1buz0047ua3j6ejhrttp` | `find`  | 找到，發現 (v.) |
| `cml3j1bv00076ua3j5cah76kg` | `price` | 價格 (n.)       |

測試組合：

1. `gpt-5.4-mini + low`
2. `gpt-5.5 + low`
3. `gpt-5.5 + fast + low`

## 速度結果

| 設定                   | Trial 1 | Trial 2 |    平均 |
| ---------------------- | ------: | ------: | ------: |
| `gpt-5.4-mini + low`   | 10.679s |  9.704s | 10.192s |
| `gpt-5.5 + low`        | 10.169s | 11.337s | 10.753s |
| `gpt-5.5 + fast + low` | 10.111s | 13.579s | 11.845s |

排序：

1. `gpt-5.4-mini + low`：最快。
2. `gpt-5.5 + low`：略慢於 mini。
3. `gpt-5.5 + fast + low`：本次最慢。

## 輸出品質觀察

### `gpt-5.4-mini + low`

兩次都輸出：

```text
I want to compare prices and find good deals.
```

特徵：

- intent 都是 `analyze_sentence`。
- 都有連到 `find` 與 `price`。
- related candidates 數量都是 3。
- 輸出較偏「多拆一些」，對收藏包 UI 較友善。

### `gpt-5.5 + low`

兩次都輸出：

```text
I want to compare prices and find a good deal.
```

特徵：

- intent 都是 `analyze_sentence`。
- 都有連到 `find` 與 `price`。
- related candidates 數量都是 2。
- 英文更自然一點，`find a good deal` 比 `find good deals` 更常見。
- 有一次 message 提到建議補充 `deal`，這符合目前收藏包想引導新增單字的方向。

### `gpt-5.5 + fast + low`

兩次都輸出：

```text
I want to compare prices and find a good deal.
```

特徵：

- intent 都是 `analyze_sentence`。
- 都有連到 `find` 與 `price`。
- related candidates 數量都是 2。
- 品質接近 `gpt-5.5 + low`，但這次速度沒有比較快。

## 對目前問題的判斷

這次三組都落在約 10-14 秒，比之前使用 `gpt-5.2 + medium` 的 20 幾秒體感明顯短。真正有效的變因看起來是：

- 從 `medium` 降到 `low`
- 使用較新的 / 較輕的模型

但 `fast mode` 沒有在這次測試中證明有幫助。原因可能是：

1. 樣本數只有每組 2 次，服務端波動很大。
2. Codex SDK agent turn 本身有固定 overhead。
3. structured output schema 仍需完整解碼後才完成。
4. fast mode 的 1.5x 加速不一定覆蓋所有 agent overhead。

## 建議

### 短期建議

先把收藏包 Codex provider 改成可設定 reasoning effort：

```env
COLLECTION_CODEX_MODEL="gpt-5.4-mini"
COLLECTION_CODEX_REASONING_EFFORT="low"
```

並在程式中讓 `modelReasoningEffort` 不要 hardcode `medium`。

### 接著加測

建議追加這幾組：

| 設定                     | 原因                                |
| ------------------------ | ----------------------------------- |
| `gpt-5.4-mini + minimal` | 可能再降 1-3 秒，適合簡短拆語塊任務 |
| `gpt-5.4-mini + low`     | 目前最佳候選                        |
| `gpt-5.5 + minimal`      | 看是否能保留 5.5 品質但更快         |

### 不建議立刻做的事

不建議直接把預設改成 `gpt-5.5 + fast`。這組理論上支援 fast mode，但這次沒有更快，且 credit 消耗更高。

## 實作建議

目前程式在：

```ts
apps / api / src / modules / collection / codex - collection - ai.provider.ts;
```

現在是：

```ts
modelReasoningEffort: "medium" as const;
```

建議改成：

```ts
private readonly modelReasoningEffort: ModelReasoningEffort;

this.modelReasoningEffort =
  configService.get<ModelReasoningEffort>('COLLECTION_CODEX_REASONING_EFFORT') ?? 'low';
```

然後：

```ts
modelReasoningEffort: this.modelReasoningEffort;
```

這樣本機 `.env` 可以先設：

```env
COLLECTION_CODEX_MODEL="gpt-5.4-mini"
COLLECTION_CODEX_REASONING_EFFORT="low"
```

## 最終建議

以這次結果，我會先選：

```env
COLLECTION_CODEX_MODEL="gpt-5.4-mini"
COLLECTION_CODEX_REASONING_EFFORT="low"
```

理由：

- 這次最快。
- 句子和語塊拆解結果可用。
- source card 命中正常，能抓到 `find` / `price`。
- 成本也比 `gpt-5.5` 和 fast mode 更低。
