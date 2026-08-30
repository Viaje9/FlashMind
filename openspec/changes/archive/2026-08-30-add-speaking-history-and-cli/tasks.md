## 1. 固定資料與 API 契約

- [x] 1.1 依 proposal／六份 specs 核對第一版範圍，確認設計預設：瀏覽器 CLI 授權、已整理後延續建立新場次、已保存 Review 不可覆寫與保守字形匹配；不得將這些預設當成已實作。
- [x] 1.2 在 OpenAPI 定義來源 APP／LOCAL、場次、訊息、缺逐字稿標記、legacy Summary、Practice context 與分頁 Wrapper；所有新增 endpoint 定義唯一 operationId。
- [x] 1.3 定義版本化 Review 草稿、帳號／環境、穩定來源範圍、引文、事件、候選、驗證結果與保存回應；補上 400／401／403／404／409／413／422 契約及文字大小／筆數上限。
- [x] 1.4 定義 CLI 短期授權建立／確認／交換、搬移逐場結果與歷史刪除契約；明示 validate 不持久化、save 不呼叫 AI。
- [x] 1.5 由同一 OpenAPI schema 產生 Web 與 CLI 可使用的型別／schema，整理 packages/shared 無框架純驗證入口；確認 CLI 不載入 Angular 或 NestJS。

## 2. 後端資料模型與純規則

- [x] 2.1 在 apps/api 新增 Speaking 場次、訊息、Review、事件、legacy Summary、write receipt 與 CLI 授權的 Prisma schema／migration；補 owner 索引、來源識別與事件唯一限制，不修改既有單字次數。
- [x] 2.2 先寫失敗的純驗證測試：未知欄位、音訊 payload、訊息重複、時間／範圍錯誤、assistant 假證據、不存在引文、substring／不明字形及不合法候選。
- [x] 2.3 實作最小共用驗證使測試通過，保留原始文字、自然化例句與引文分離；以 canonical JSON 定義排版不影響而內容變更會影響的指紋。
- [x] 2.4 先寫並通過來源 sourceKey、內容指紋、四狀態不降級、同場同字同 type 去重及舊事件不覆蓋新例句的 Domain／Service Red-Green 測試。

## 3. 歷史與 Practice context API

- [x] 3.1 先寫歷史 Service 失敗測試：帳號隔離、未整理 App 保存、client ID 重試、revision 衝突、按練習時間穩定分頁及完整訊息分頁。
- [x] 3.2 實作 APP 場次建立、已完成文字批次保存、列表／明細 API 與必要 metadata，套用 AuthGuard／WhitelistGuard；使 3.1 測試通過。
- [x] 3.3 實作明確確認後的歷史刪除，移除可回顧文字／Review／詳細證據但保留最小 receipt；驗證不重算次數、不自動刪卡、不被搬移重試復活。
- [x] 3.4 先寫 context Service 失敗測試：四種狀態完整字表、零資料、總數一致、App／LOCAL 最新計畫、補匯入舊場、刪除後回退及 legacy context 關聯。
- [x] 3.5 實作一致讀取的完整 context API 與版本／總數／上限檢查，使 3.4 測試通過；確認沒有建立場次、AI 呼叫或單字寫入。

## 4. Review 驗證、交易與 App 分析邊界

- [x] 4.1 先寫 Review Service 失敗測試：validate 零寫入、未知單字／他人資源／帳號環境不符、舊 context 狀態推進、schema 錯誤及全部欄位錯誤路徑。
- [x] 4.2 實作 validate API：共用結構規則加上最新帳號／字表／證據驗證，輸出 valid、hash、errors、warnings；不得保存遠端草稿或記錄原文 payload。
- [x] 4.3 先寫使用真實測試 DB 的交易測試：LOCAL 對話與 Review 原子保存、App 原文字保留、途中失敗回滾、同內容重試／並行重試只計一次、不同內容 409。
- [x] 4.4 實作 save Service 與 write receipt 唯一限制，讓 TargetVocabulary 更新使用同一交易，且僅對新事件計次；使 4.3 測試通過。
- [x] 4.5 驗證 same-sourceKey 新 requestId 仍防重、已加入後相同內容重試仍成功、舊事件不覆蓋最近例句、同字使用與推薦各一次；補上相應測試與錯誤契約。
- [x] 4.6 先補 Summary 無副作用測試，再移除 summarizeConversation 內直接 applyReview；App AI 輸出加入證據欄位並沿用共用驗證，不只信任模型 JSON。
- [x] 4.7 驗證保存不呼叫 AI、不改寫確認內容、不建卡、不更動 FSRS；候選資料保留於保存快照，依後續確認移除歷史 Summary 的候選區塊。

## 5. CLI 登入與四個命令

- [x] 5.1 先寫授權 Service 失敗測試：限時、單次原子兌換、無 verifier 不可兌換、跨帳號／Origin／CSRF 防護、取消、過期與限流。
- [x] 5.2 實作短期 CLI 授權 API 與瀏覽器確認頁，沿用 Email／Google 登入及 session；核對成功回應 no-store，token 不出現在 URL、輸出或日誌。
- [x] 5.3 建立 apps/cli workspace、bin、TypeScript 建置、本機安裝／連結入口與獨立 HTTP adapter；驗證從 repo 外任意工作目錄執行。
- [x] 5.4 實作 flashmind login、origin 設定與 repo 外憑證保存，限制檔案存取、隔離環境、不跨 origin 轉送 cookie；測試 session 失效後非互動指令明確失敗。
- [x] 5.5 實作 flashmind practice context：stdout 單一完整 JSON、stderr 訊息、總數／版本／大小檢查；不得只輸出第一頁或待練習單字。
- [x] 5.6 實作 flashmind review validate <file>：本機解析加線上唯讀驗證，輸出機器可讀錯誤並以非 0 表示失敗；保留原草稿。
- [x] 5.7 實作 flashmind review save <file>：固定讀檔快照、再次驗證、保存與重試結果；錯誤時不改檔、不換帳號、不重新生成內容。
- [x] 5.8 補 CLI 整合測試：四命令 help／參數、stdout 純 JSON、解析／驗證／認證／網路／衝突 exit code，日誌不洩漏憑證或對話。

## 6. App 文字同步與統一口說歷史

- [x] 6.1 依前端分層先寫 Domain／Store 失敗測試：文字 API 保存與本機音訊分離、穩定訊息 ID、最終逐字稿而非串流片段、待同步提示與重試。
- [x] 6.2 拆分 Speaking 文字 Repository 與本機 Audio Repository，保留帳號隔離的待同步文字及音訊映射；登入切換不提交他人資料。
- [x] 6.3 App 開始 Practice 時讀取後端 context，替代 localStorage 中的 lastPractice／nextPractice 來源；聲音、顯示等裝置設定保持本機。
- [x] 6.4 調整 App Summary 流程：先同步文字、分析、保存 Review；保存失敗保留同一份結果供重試，避免每次重產及重複計次。
- [x] 6.5 口說歷史改讀後端 cursor 列表與完整明細，標示 App／本機與未整理狀態，保留複製摘要及確認刪除；回顧不得觸發 AI 或計次。
- [x] 6.6 實作已整理場次「延續為新練習」與未整理 APP 繼續追加，保持原來源與確認結果不可變；用新場次測試分開計次。
- [x] 6.7 顯示本機原音可用／不可用狀態，原裝置仍可播放；修改容量清理只刪音訊、不刪雲端文字或未同步資料，保留原有播放／翻譯回歸。

## 7. IndexedDB 舊資料搬移

- [x] 7.1 建立搬移 fixtures：多場、同場多 Summary、只有文字 Summary、已翻譯訊息、缺逐字稿音訊、重複識別、無帳號及可／不可關聯的 nextPractice。
- [x] 7.2 先寫搬移 Service Red 測試，再實作逐場交易、來源 ID／hash 去重、已搬移回應與衝突；驗證不呼叫 AI、不建立單字事件、不改變計數。
- [x] 7.3 先寫前端搬移 Domain／Store Red 測試，再實作 App 偵測／選擇紀錄／帳號確認／進度／逐場成功失敗結果；未授權不得自動搬移。
- [x] 7.4 保存帳號範圍的本機至後端映射，成功後列表去除副本但保留原文字備份與音訊；斷線／重新整理可重試，失敗不清除原資料。
- [x] 7.5 僅搬移可證實關聯的 lastPractice／nextPractice；驗證較舊資料不覆蓋較新計畫、無關聯資料留本機、已刪除 receipt 不被復活。

## 8. Skill 整合文件與端到端驗收

- [x] 8.1 在本專案提供 CLI 使用文件、有效／無效草稿範例與 schema 說明，明示 validate 會傳輸但不保存文字、save 才寫入；不修改外部專案 skill。
- [x] 8.2 提供 Practice／Review skill 整合步驟：context → 練習 → Agent 草稿 → 自動 validate → 展示／修正 → 明確儲存才 save；示範獨立 Review 重新取得 context。
- [x] 8.3 先寫 E2E Red 案例，再驗證「App 練習同步 → 另一瀏覽器文字回顧」、「CLI context／validate 無寫入 → save → App 本機來源明細」；使用既有測試帳號檔，不硬編碼密碼。
- [x] 8.4 驗證 E2E 搬移／中斷重試／保留原音／另一瀏覽器缺音訊／容量清理／帳號切換，確認原始對話、Review 與單字次數一致。
- [x] 8.5 驗證 CLI 瀏覽器授權與 401／403／404、保存衝突、逾時後重送、相同草稿並行提交、確認前零寫入；先列案例再執行，不以單元測試代替完整流程。
- [x] 8.6 執行受影響 API Service、Web Domain／Store、CLI 測試與建置，核對 OpenAPI client 同步、前端可存取性和必要的既有 Speaking 播放／翻譯回歸；分開回報已驗證與未驗證。

## 9. 發佈相容與完成檢查

- [x] 9.1 撰寫 DB 向前 migration、Web／API Summary 協調切換、舊 PWA 更新提示與回滾指引；回滾不刪新資料、不重新啟用會重複計次的舊寫入。
- [x] 9.2 在測試環境驗證新舊頁面交錯呼叫 Summary 不雙重計次、搬移前後字詞彙總不變、重新登入及更新後可讀兩種來源。
- [x] 9.3 逐項核對六份 specs 的 scenarios，執行 OpenSpec strict 驗證與 git diff --check，記錄尚未完成的產品契約；完成前不標記所有實作任務已完成。
