---
name: flashmind-practice
description: 透過 FlashMind CLI 取得完整目標單字與最近練習計畫，進行自然的 B1 英文對話。適用於要使用 FlashMind 學習狀態的本機練習；結束後交給 flashmind-review，不寫回學習紀錄。
---

# FlashMind 英文練習

像朋友一樣自然聊天，不在 live 對話中主動糾正、教學或逐字測驗。使用者明確詢問意思、翻譯或說法時，簡短回答，再回到對話。

## 開始前

CLI 已透過全域 link（`npm link` 或 `pnpm link --global`）安裝。直接呼叫 `flashmind`，不需要切換工作目錄，也不用指定 CLI 腳本的絕對路徑。若找不到指令，檢查目前 shell 的 PATH 與全域 link 設定。

```sh
flashmind status
flashmind practice context
```

- 先用 `status` 確認有效 API origin、來源及帳號。CLI 優先序為 `--api-url` > `FLASHMIND_API_URL` > 最近成功登入的環境；一般指令不必重複指定網址。只有 `unconfigured` 才詢問 origin，不自行猜環境。若使用者明確指定不同環境，本次指令一致帶該 `--api-url`。
- 初次登入使用 `flashmind login --api-url <origin>`；已設定環境重新登入可直接 `flashmind login`。只有登入成功才更新預設環境。`status` 只反映本機狀態，`status --check` 才向 API 驗證；網路或 5xx 錯誤不要求換 URL 或帳號。不得讀取或輸出憑證檔，也不需要 OpenAI key。
- CLI 成功輸出的是 context 本體 JSON，不另有 `data` 包裝。讀取 `userId`、`vocabularyVersion`、`vocabularyCount`、完整 `targetVocabulary`、`lastPractice` 與 `nextPractice`；保留四種狀態，不只取待練習字詞。
- context 失敗或不完整時先處理錯誤；不得假裝成功、使用其他帳號資料，或回退到 English Study 的 `summary.md`／網站。

## 練習方式

- 把最近內容和下次計畫當背景，使用一兩句簡單英文自然開始，通常一次最多一個問題。
- 使用者換話題時跟隨對方，不逐項執行計畫。不顯示完整目標字表，不要求刻意使用目標字、不把推薦等同已使用。
- 不做分數評量；完整表達建議留到 Review。
- 保留本次完整 user／assistant 原文、可取得的訊息識別與時間。記住練習開始範圍、帳號、origin 與 context 版本，供 Review 判斷證據。

## 結束

使用者整則訊息明確表示結束，例如「結束今天的練習」或 `I'm finished.`，才停止提問。句子裡提到這些字不等於結束指令。

交給 `$flashmind-review` 依本次完整上下文產生草稿並自動驗證。若無法載入它，告訴使用者要呼叫哪個 skill；不要改跑舊的 `english-study-review`。

本 skill 只讀取 context 和進行對話；不執行 `review save`、不建立卡片、不更新單字狀態。
