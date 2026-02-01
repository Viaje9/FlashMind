# daily-reset-hour Specification

## Purpose
TBD - created by archiving change fix-daily-quota-and-add-reset-hour. Update Purpose after archive.
## Requirements
### Requirement: 學習日起始計算
系統 SHALL 根據牌組的 `dailyResetHour` 計算學習日起始時間。

#### Scenario: 當前時間已過重置時間
- **WHEN** 當前時間已超過今天的 `dailyResetHour`
- **THEN** 學習日起始時間 SHALL 為今天的 `dailyResetHour` 整點

#### Scenario: 當前時間尚未到重置時間
- **WHEN** 當前時間尚未到達今天的 `dailyResetHour`
- **THEN** 學習日起始時間 SHALL 為昨天的 `dailyResetHour` 整點

#### Scenario: 當前時間恰好等於重置時間
- **WHEN** 當前時間等於今天的 `dailyResetHour`
- **THEN** 學習日起始時間 SHALL 為今天的 `dailyResetHour` 整點

#### Scenario: 重置時間為 0 點
- **WHEN** `dailyResetHour` 設定為 0
- **THEN** 學習日起始時間 SHALL 等同午夜計算邏輯

#### Scenario: 重置時間為 23 點
- **WHEN** `dailyResetHour` 設定為 23 且當前時間為 22:00
- **THEN** 學習日起始時間 SHALL 為昨天 23:00

