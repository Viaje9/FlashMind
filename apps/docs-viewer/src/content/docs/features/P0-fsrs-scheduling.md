---
title: "FSRS 排程"
priority: P0
---

# FSRS 排程

## 概述

採用 FSRS（Free Spaced Repetition Scheduler）演算法，比傳統 SM-2 更高效的間隔重複排程。這是 FlashMind 的核心差異化功能。

## 技術依賴

- 使用開源實作 [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)

## 功能要點

- [ ] 根據用戶評分（知道/不熟/不知道）計算下次複習時間
- [ ] 「知道」的卡片間隔最長
- [ ] 「不知道」的卡片間隔最短，且在本次學習中再次出現
- [ ] 優先顯示待複習卡片，再顯示新卡
- [ ] 每日學習數量依用戶設定上限

## 參考資料

- [FSRS 演算法說明](https://github.com/open-spaced-repetition/fsrs4anki)
