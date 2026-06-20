# 收藏包新增收藏對話窗測試報告 2026-06-20

## 測試環境

- 測試頁面：`http://localhost:4280/collections/new`
- 測試方式：Codex in-app browser 實際操作頁面
- 測試重點：非單純中文句子的輸入情境、assistantMessage 語氣、可收藏卡片、建議新增單字、瀏覽器錯誤
- 瀏覽器 console：未觀察到 error / warn

## 測試結果摘要

| #   | 輸入                                 | 結果                                                                  | 評估     |
| --- | ------------------------------------ | --------------------------------------------------------------------- | -------- |
| 1   | `吃飽了英文怎麼說？`                 | 回 `I’m full.`，建議新增 `full`                                       | 通過     |
| 2   | `如果我想跟店員說不要醬，要怎麼講？` | 回 `No sauce, please.`，建議新增 `sauce`                              | 通過     |
| 3   | `postpone 怎麼用？`                  | 回 `We need to postpone the meeting.`，建議新增 `postpone`、`meeting` | 部分通過 |
| 4   | `I am full food 這樣對嗎？`          | 修正成 `I’m full.`，建議新增 `full`                                   | 通過     |
| 5   | `餐廳常用句`                         | 回 3 句餐廳常用句，建議 `menu`、`order`、`bill`                       | 部分通過 |
| 6   | `你可以陪我聊天嗎？`                 | 轉成 `Can you chat with me?`，建議新增 `chat`                         | 通過     |

## 詳細觀察

### 1. 問英文怎麼說

輸入：

```text
吃飽了英文怎麼說？
```

assistantMessage：

```text
可以說 I’m full. 這句很自然；這句需要一個新核心字，建議新增 full。
```

畫面結果：

- 可收藏表達：`I’m full.`
- 建議新增單字：`full`
- 沒有出現 `可連結`、`sourceCardIds`、`candidates`、`suggestedCards` 等內部語言

評估：符合預期。

### 2. 情境式問法

輸入：

```text
如果我想跟店員說不要醬，要怎麼講？
```

assistantMessage：

```text
可以說 No sauce, please. 這句在店裡點餐時很自然、簡短有禮貌。這句需要一個新核心字：sauce。
```

畫面結果：

- 可收藏表達：`No sauce, please.`
- 額外語塊：`no sauce`
- 建議新增單字：`sauce`

評估：符合預期。

### 3. 問單字用法

輸入：

```text
postpone 怎麼用？
```

assistantMessage：

```text
可以說 We need to postpone the meeting. 這句很自然，意思是「我們需要把會議延後」。這句需要一個新核心字 postpone；另外 meeting 也是句子裡的核心名詞，值得一起新增。
```

畫面結果：

- 可收藏表達：`We need to postpone the meeting.`
- 語塊：`postpone the meeting`
- 建議新增單字：`postpone`、`meeting`

評估：方向正確，因為它沒有變成字典解釋，而是回到可收藏句。不過如果測試帳號其實已經有 `meeting`，這代表缺字判斷需要再檢查；如果沒有，則結果合理。

### 4. 修正英文

輸入：

```text
I am full food 這樣對嗎？
```

assistantMessage：

```text
可以說 I’m full. 這句很自然；不要說 I am full food。這句需要一個新核心字 full，意思是「飽的」。
```

畫面結果：

- 可收藏表達：`I’m full.`
- 語塊：`be full`
- 建議新增單字：`full`

評估：符合預期。英文修正有成功導回「可收藏句子」。

### 5. 模糊需求

輸入：

```text
餐廳常用句
```

assistantMessage：

```text
可以先練這三句：Could I see the menu, please?、I’d like to order now.、Could we have the bill, please? 這句需要一個新核心字；因為你的單字庫目前還沒有餐廳情境的核心字，建議新增 menu、order、bill。
```

畫面結果：

- 產生 3 個句子
- 每句又拆出 1 個語塊
- 建議新增 3 個單字

評估：沒有跑去一般聊天，方向對；但畫面一次出現 9 張卡片，資訊量偏多。若產品要保持「一次練一句」的核心，建議模糊需求改成最多 1 到 2 句，或先要求使用者選一個具體中文句子。

### 6. 非功能需求 / 閒聊式輸入

輸入：

```text
你可以陪我聊天嗎？
```

assistantMessage：

```text
可以說 Can you chat with me? 這句自然、簡單，適合表達「你可以陪我聊天嗎？」這句需要一個新核心字，建議新增 chat。
```

畫面結果：

- 可收藏表達：`Can you chat with me?`
- 語塊：`chat with me`
- 建議新增單字：`chat`

評估：符合目前產品方向。它沒有進入一般聊天，而是把問題轉成可收藏英文句。

## 主要結論

目前對話窗已能處理「問題型輸入」，不只限於使用者直接貼中文句子。實測下列類型都可用：

- 問英文怎麼說
- 情境式問法
- 問單字用法
- 修正英文
- 模糊主題
- 閒聊式問題

assistantMessage 的語氣也比先前好，沒有再出現內部資料語言。

## 建議調整

1. 模糊需求要限制輸出量

`餐廳常用句` 一次產生 3 句、3 個語塊、3 個單字，畫面偏滿。建議 prompt 加規則：

```text
如果使用者輸入的是寬泛主題，最多提供 1 到 2 個句子候選，避免一次產生太多卡片。
```

2. assistantMessage 避免「這句」指代多句

`餐廳常用句` 的 assistantMessage 說「這句需要一個新核心字」，但前面列了三句，語意不精準。建議寬泛主題時改成：

```text
可以先練這幾句。這些句子會用到 menu、order、bill，建議先新增這幾個核心字。
```

3. 檢查既有單字去重

`postpone 怎麼用？` 同時建議 `meeting`。如果測試帳號已有 `meeting`，就代表 `suggestedCards` 去重或 tool 查詢需要調整；如果沒有，則可接受。

4. 串流體感可再加一個明確 UI 測試

本次 in-browser 測試確認最終畫面正確、沒有 console error；若要更精準驗證 token streaming，建議加一個自動化測試用 mock SSE 慢速分段輸出，檢查 assistant bubble 在 `result` 回來前已逐步更新。
