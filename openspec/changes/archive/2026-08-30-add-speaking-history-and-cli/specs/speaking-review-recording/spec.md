## ADDED Requirements

### Requirement: 本機草稿包含可回顧的對話與結構化結果

Review 草稿 SHALL 使用明確版本的 JSON schema，包含目標帳號、context 版本、穩定練習識別、來源、練習時間與範圍、帶 ID 與角色的原始文字訊息、Summary、Review、實際使用、推薦、下次練習建議與加入牌組候選。外部匯入來源 SHALL 為 `LOCAL`。

#### Scenario: 草稿涵蓋完整練習

- **WHEN** Agent 建立本機練習草稿
- **THEN** 對話僅包含已界定練習範圍內的 user／assistant 文字
- **AND** system／developer 指示、工具內容及結束後的 Review 討論不得混入對話
- **AND** 原始對話與自然化例句分開保存，不能以改寫後摘要取代原始對話

#### Scenario: 範圍或來源內容不足

- **WHEN** 無法取得完整練習文字或辨識開始／結束範圍
- **THEN** Agent 明確回報缺漏，不自行補造對話、時間或使用證據
- **AND** 該草稿不得以完整外部 Review 的形式保存

### Requirement: 草稿驗證無學習資料副作用

驗證 SHALL 檢查 schema、帳號、來源、時間順序、訊息 ID、目標字表歸屬、實際使用證據關聯、重複事件及牌組候選條件，回傳欄位路徑、錯誤碼與可讀原因。驗證 MUST NOT 建立遠端草稿、保存對話、改變學習狀態或呼叫 AI。

#### Scenario: 草稿驗證通過

- **WHEN** Agent 執行驗證且所有檢查通過
- **THEN** 回傳有效結果與本次草稿的內容識別
- **AND** 後端場次、Review、單字次數及下次計畫保持不變
- **AND** 驗證結果不宣稱語意判斷或學習成效已由工具證實

#### Scenario: 草稿含有不存在或他人的目標單字

- **WHEN** 草稿事件引用不屬於目前帳號的單字
- **THEN** 驗證回報該欄位錯誤
- **AND** 不自動新增單字或靜默丟棄事件使草稿變成另一份結果

### Requirement: 實際使用以使用者原始表達為證據

每筆實際使用 SHALL 引用本場 `user` 訊息 ID 與可核對的原文片段；推薦 SHALL 與實際使用分開。系統 MUST 拒絕助理訊息、不存在的引文、只有語意近似或較長字串包含目標字的假證據。Agent SHALL 排除只詢問字義、跟讀與 Review 新提供例句的情況。

#### Scenario: 助理說過但使用者沒用過

- **WHEN** 目標單字只出現在 assistant 訊息或 Review 例句
- **THEN** 不得建立實際使用事件或將該字改成已使用
- **AND** 若符合本次對話需求，只能另列為推薦

#### Scenario: 不確定的字形對應

- **WHEN** 原始片段只有目標字的變化形式，且沒有經契約定義的可驗證對應
- **THEN** 不得透過改寫自然句製造原形證據
- **AND** 回報需確認的字形問題，不猜測為已使用

### Requirement: 確認後保存同一份內容

Review skill SHALL 先自動驗證與展示草稿，在使用者明確授權儲存後才呼叫保存。保存 SHALL 再次驗證送出的檔案，保存確認過的語意內容及原始對話，不呼叫 AI 重新生成，不接受 payload 直接覆寫單字 status 或累積次數。

#### Scenario: 使用者修正草稿

- **WHEN** 使用者要求調整 Review
- **THEN** Agent 更新本機 JSON、重新驗證並展示更新內容
- **AND** 不因先前驗證成功就自動保存修正版

#### Scenario: 驗證後切換帳號或目標字表改變

- **WHEN** 保存時的帳號與草稿不同，或依賴的單字已不存在
- **THEN** 保存拒絕並要求重新取得 context、檢視草稿
- **AND** 不改寫目標帳號、不部分套用可用事件

### Requirement: Review 與單字變更原子保存

系統 SHALL 在同一資料庫交易內保存本機場次、訊息、Review 與單字事件，並更新相關單字與練習上下文。App 既有文字已保存時，Review 失敗不得刪除原對話。

#### Scenario: 單字更新途中失敗

- **WHEN** 保存 Review 時其中一項資料庫操作失敗
- **THEN** 本次新增 Review 與所有單字變更回滾
- **AND** 本機匯入不得留下缺 Review 的半份場次
- **AND** App 原先已保存的文字仍可回顧與重試

### Requirement: 重試與內容衝突有明確結果

系統 SHALL 以帳號、來源與穩定練習識別防止重複保存，以內容指紋核對同一份草稿。相同草稿的序列或並行重試 SHALL 回傳同一筆結果；同一識別但不同內容 SHALL 回傳衝突，不覆蓋已確認結果。第一版不提供已保存 Review 改版重算。

#### Scenario: 寫入成功但 CLI 沒收到回應

- **WHEN** Agent 以同一練習識別與相同草稿重試
- **THEN** 回傳原場次／Review ID 與已保存狀態
- **AND** 不增加第二筆歷史、事件、使用次數或推薦次數

#### Scenario: 相同對話用新的隨機 request ID 重送

- **WHEN** 同一來源的同一場練習範圍已保存，只更換請求識別
- **THEN** 後端仍以穩定練習識別防重
- **AND** 不把每次 CLI 執行當成新練習

### Requirement: 四種單字狀態以事件推進

後端 SHALL 依目前資料庫狀態套用事件：推薦僅將 `UNSEEN` 推進為 `PRACTICING`；實際使用將 `UNSEEN` 或 `PRACTICING` 推進為 `USED`；`USED` 不因推薦退回，`ADDED` 永不因 Review 降級。每場每字每種事件最多累加一次，同場可同時有使用與推薦。補匯入舊事件可增加次數，但最近語境／自然例句 SHALL 依練習時間更新，不由到達先後覆蓋。

#### Scenario: 待接觸的字直接被使用

- **WHEN** Review 有可核對的實際使用證據，且該字目前為 `UNSEEN`
- **THEN** 該字可直接變成 `USED` 並增加一次使用紀錄

#### Scenario: 已加入牌組的字再次使用

- **WHEN** 草稿記錄一個目前已為 `ADDED` 的單字再次被使用
- **THEN** 系統保留 `ADDED` 與原卡片關聯並增加一次使用紀錄
- **AND** 不因 context 較舊而退回 `USED`

#### Scenario: 補匯入過去的使用紀錄

- **WHEN** 一個單字已有較新練習的自然例句，後來匯入較舊的合法使用事件
- **THEN** 該舊事件保存在原場次並增加一次使用紀錄
- **AND** 單字的最近自然例句仍來自較新的練習

### Requirement: 加入牌組候選不等於建卡

Review SHALL 可列出本次實際使用且預期保存後符合既有加入條件的單字作為候選。驗證與保存 MUST NOT 建立卡片、修改 FSRS 排程或把單字標為 `ADDED`；實際加入仍由 App 既有操作執行並再次檢查最新狀態。

#### Scenario: Review 保存候選但不建立卡片

- **WHEN** 保存的 Review 包含加入牌組候選
- **THEN** 系統保存候選資料，但卡片數不因 Review 保存而增加
- **AND** 歷史 Summary 不另外呈現候選區塊，移除顯示不刪除已保存的候選資料
- **AND** 使用者之後透過 App 既有操作加入時，系統檢查最新狀態；已加入的單字不重複建卡

### Requirement: App 分析與保存使用相同邊界

App 的 Summary 分析 SHALL 不再直接更新目標單字，保存 Review SHALL 使用與 CLI 相同的驗證、事件與防重邏輯。App 可在使用者按下原有 Summary 動作後串接分析與保存，不強制套用本機 skill 的對話確認介面。

#### Scenario: App 分析成功但保存失敗

- **WHEN** App 收到 Summary 結果但保存 Review 失敗
- **THEN** 原文字與待保存結果仍可重試
- **AND** 單字狀態與次數未被分析步驟提前更新
- **AND** App 不宣告該 Review 已同步
