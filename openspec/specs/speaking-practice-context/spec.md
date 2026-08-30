# speaking-practice-context Specification

## Purpose

定義供 App 與 CLI 共用的完整且唯讀 Speaking 練習上下文，包含目標單字狀態、最近整理紀錄、下次練習計畫、版本與一致性規則。

## Requirements

### Requirement: 完整且唯讀的學習上下文

系統 SHALL 提供帳號範圍的 Practice context，包含 schema 版本、帳號識別、取得時間、完整目標單字、最近已整理練習與下次練習計畫。目標單字 SHALL 至少包含穩定識別、字詞、中文意思、`UNSEEN`／`PRACTICING`／`USED`／`ADDED` 狀態、使用與推薦次數，以及可用的語境與自然例句。

#### Scenario: 取得四種狀態的單字

- **WHEN** Agent 執行 `flashmind practice context`
- **THEN** 回傳該帳號全部目標單字，不只回傳待練習或第一頁
- **AND** 同時包含可取得的最近 Summary 與下次主題、目標、引導問題及回想目標
- **AND** 不建立場次、不呼叫 AI、不改變單字或次數

#### Scenario: 沒有歷史或目標單字

- **WHEN** 帳號尚無 Review 或目標單字
- **THEN** 對應欄位明確回傳 null 或空陣列，仍符合固定 schema
- **AND** 不生成虛構的上次練習或預設已學會單字

### Requirement: 上下文完整性可核對

上下文 SHALL 帶有單字總數及版本識別，API 必須提供一致的完整快照；若內部分頁或大小超限，CLI MUST 完整取得或明確失敗，不得悄悄截斷。

#### Scenario: 讀取時資料變動或回應不完整

- **WHEN** 單字資料讀取中變動而無法維持同一版本，或回傳筆數與宣告總數不同
- **THEN** 系統重新取得一致快照或回報失敗
- **AND** 不將不完整 JSON 當作可供 Review 判斷的完整字表

### Requirement: 以練習時間延續最近計畫

系統 SHALL 以練習結束時間及穩定次序選出最近有效、已保存且未刪除的整理紀錄，App 與 CLI 使用相同規則。不得以匯入時間或單純上次瀏覽裝置的 localStorage 覆蓋它。

#### Scenario: 本機較新的 Review 已寫回

- **WHEN** 使用者在 App 或本機開始下一次 Practice
- **THEN** 兩者取得相同的最新 Review 摘要與下次練習建議
- **AND** 補匯入舊紀錄不使下一次計畫退回過去

### Requirement: 目標單字是背景而不是使用證據

Practice skill SHALL 將上下文當成自然對話背景，不因取得清單就標記使用或強制測驗。Review SHALL 依實際使用者對話判斷，並能重新呼叫同一個唯讀 context 指令取得新快照；不依賴 Practice 與 Review 必須在同一個 Agent 工作階段。

#### Scenario: Review 獨立執行

- **WHEN** Review skill 具有本次對話，但沒有之前的 context 或資料已過時
- **THEN** 它可先呼叫 `flashmind practice context` 取得目前帳號的完整上下文
- **AND** 取得上下文不啟動新的練習、不自動寫回
