## MODIFIED Requirements

### Requirement: 同一張卡片產生雙向 StudyCard

系統 SHALL 在啟用反向學習時，為同一張卡片產生正向與反向兩個等權的 StudyCard。兩者共用同一張底層卡片資料，但在學習流程中 SHALL 被視為獨立卡面，依各自排程與今日額度參與出牌。

#### Scenario: 啟用反向時回傳雙向 StudyCard

- **WHEN** 牌組的 `enableReverse` 為 `true`
- **AND** 使用者請求學習卡片
- **THEN** 每張符合排程的卡片 SHALL 可同時以 FORWARD 和 REVERSE 方向出現
- **AND** 正向 StudyCard 的 `direction` 為 `FORWARD`
- **AND** 反向 StudyCard 的 `direction` 為 `REVERSE`
- **AND** 兩個 StudyCard 的 `id` 相同（同一張卡片）
- **AND** 兩個 StudyCard 的 `state` 分別來自正向與反向排程

#### Scenario: 開啟反向後雙向卡面等權參與出牌

- **WHEN** 牌組的 `enableReverse` 為 `true`
- **THEN** 正向與反向 StudyCard SHALL 在今日學習池中被視為等權候選
- **AND** 系統 SHALL 優先以 `1:1` 比例安排正向與反向卡面
- **AND** 若任一方向候選不足，另一方向 SHALL 可補位

#### Scenario: 同一底層卡可於同日出現雙向卡面

- **WHEN** 同一張卡片的正向與反向排程都符合今日學習條件
- **THEN** 系統 SHALL 可在同一天回傳該卡片的正向與反向 StudyCard
- **AND** 系統 SHALL 維持最小間距規則，避免短時間內連續出現同卡雙向

#### Scenario: 未啟用反向時只回傳正向 StudyCard

- **WHEN** 牌組的 `enableReverse` 為 `false`
- **AND** 使用者請求學習卡片
- **THEN** 系統 SHALL 只回傳 FORWARD 方向的 StudyCard
- **AND** SHALL NOT 查詢或回傳反向排程
