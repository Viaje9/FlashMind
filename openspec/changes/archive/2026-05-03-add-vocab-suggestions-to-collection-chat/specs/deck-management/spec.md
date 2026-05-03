## ADDED Requirements

### Requirement: 收藏包新增單字流程可選擇牌組

系統 SHALL 讓收藏包新增單字流程取得使用者可用牌組，並讓使用者選擇新卡片要加入的牌組。

#### Scenario: 顯示可用牌組

- **WHEN** 使用者從收藏包單字候選點擊加號
- **THEN** 系統 SHALL 顯示使用者自己的牌組列表
- **AND** 每個牌組選項 SHALL 顯示牌組名稱
- **AND** 系統不得顯示其他使用者的牌組

#### Scenario: 選擇牌組後新增卡片

- **WHEN** 使用者選擇一個牌組
- **THEN** 後續新增快閃卡表單 SHALL 使用該牌組 id 建立卡片

### Requirement: 收藏包新增單字流程記住上次牌組

前端 SHALL 記住使用者在收藏包新增單字流程中上次選擇的牌組，並在下一次新增單字時預選。

#### Scenario: 儲存上次選擇

- **WHEN** 使用者在收藏包新增單字流程中選擇牌組
- **THEN** 前端 SHALL 將該牌組 id 保存於 localStorage

#### Scenario: 下次預選有效牌組

- **WHEN** 使用者再次從收藏包單字候選點擊加號
- **AND** localStorage 中的牌組 id 仍存在於使用者可用牌組列表
- **THEN** 牌組選擇 UI SHALL 預選該牌組

#### Scenario: 上次牌組已不存在

- **WHEN** localStorage 中的牌組 id 不存在於使用者可用牌組列表
- **THEN** 前端 SHALL 忽略該儲存值
- **AND** 前端 SHALL 清除或覆蓋無效的 localStorage 值
