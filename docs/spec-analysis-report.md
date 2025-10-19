## 規格分析報告

| 編號 | 類別 | 嚴重度 | 位置 | 摘要 | 建議 |
|------|------|--------|------|------|------|
| C1 | 憲法衝突 | 嚴重 | specs/001-app-prompt/spec.md:119 | FR-015 允許「Storybook（或同等元件樣板）」，違背憲法第 VIII 條對 Storybook 的唯一性要求。 | 修改 FR-015，明確限定採用 Storybook，移除替代工具的描述。 |
| U1 | 規格不足 | 高 | specs/001-app-prompt/plan.md:1 | plan.md 只有背景與結構，缺乏實作階段、里程碑與執行步驟。 | 補充實作階段、順序與限制，讓任務能追溯到計畫意圖。 |
| I1 | 不一致 | 高 | specs/001-app-prompt/plan.md:30; specs/001-app-prompt/tasks.md:23 | 計畫指定 `openapi.json` 為唯一來源，但任務指向 `openapi.yaml`，恐導致契約分裂。 | 統一契約檔路徑與副檔名，更新相關文件與任務。 |
| G1 | 覆蓋缺口 | 高 | specs/001-app-prompt/spec.md:108 | FR-004 的首登手勢提示與設定開關沒有任何任務或測試覆蓋。 | 新增實作與測試任務，涵蓋提示顯示與設定切換。 |
| G2 | 覆蓋缺口 | 高 | specs/001-app-prompt/spec.md:113 | FR-009 要求在「大量 Again」後給出建議，但任務/測試未涵蓋該邏輯。 | 為建議觸發與提示流程補上實作與測試任務。 |
| G3 | 覆蓋缺口 | 高 | specs/001-app-prompt/spec.md:115; specs/001-app-prompt/tasks.md | FR-011 要求匿名轉登入覆蓋與稽核紀錄，任務僅涵蓋通用同步，缺少特定流程。 | 補齊登入升級流程、衝突處理與稽核記錄的實作與測試。 |
| I2 | 不一致 | 中 | specs/001-app-prompt/plan.md:20; specs/001-app-prompt/spec.md:134 | 計畫訂 <100ms 手勢回饋，但成功指標 SC-001 允許 1 秒，量測標準矛盾。 | 統一目標（調整 SC-001 或計畫描述）並說明原因。 |
| A1 | 含糊 | 中 | specs/001-app-prompt/spec.md:114 | FR-010 提到「即時」更新與「連勝紀錄」，未定義時效或計算標準。 | 明確定義更新延遲上限及連勝規則，方便測試驗證。 |
| G4 | 覆蓋缺口 | 中 | specs/001-app-prompt/spec.md:110 | FR-006 要求「分享進度」功能，但任務僅規畫今日完成畫面。 | 新增分享功能的實作與測試任務，含後端或整合需求。 |
| U2 | 規格不足 | 中 | specs/001-app-prompt/spec.md:101 | 規格缺少非功能性需求章節，性能/可靠性要求散落於其他文件。 | 補充專章列出性能、離線、可及性等非功能需求。 |
| A2 | 含糊 | 中 | specs/001-app-prompt/spec.md:113 | 「大量 Again 評分」缺乏量化標準，測試與實作無法具體判斷。 | 定義觸發門檻（例如單次 session Again >30%）以利實作驗證。 |

**需求覆蓋摘要**

| Requirement Key | 是否具任務 | Task IDs | 備註 |
|-----------------|------------|----------|------|
| manage-decks-crud | 是 | T023,T026,T027,T029,T030,T031 | — |
| deck-independence | 是 | T024,T028,T029,T031 | — |
| tri-swipe-handling | 是 | T009,T011,T012,T013,T014,T015,T020 | — |
| review-gesture-hints | 否 | — | 見 G1。 |
| skip-same-day | 是 | T013 | — |
| review-completion-screen | 部分 | T012,T020 | 分享功能缺失（見 G4）。 |
| ai-card-creation | 是 | T001,T033,T034,T035,T037,T038,T040,T041,T042 | — |
| ai-failure-fallback | 是 | T008,T033,T035,T039,T040,T041 | — |
| deck-daily-cap | 部分 | T023,T026,T027,T030 | 建議提示缺失（見 G2）。 |
| live-review-progress | 部分 | T014,T021 | 缺乏延遲與連勝定義（見 A1）。 |
| anonymous-login-sync | 部分 | T016,T019 | 未涵蓋覆蓋流程與稽核（見 G3）。 |
| offline-replay | 是 | T010,T016,T017,T018,T019 | — |
| bottom-nav | 是 | T044,T045,T046,T047,T048,T049 | — |
| data-contract-enrichment | 是 | T003,T004,T005,T006,T042 | JSON/YAML 路徑需一致（見 I1）。 |
| storybook-coverage | 是 | T022,T032,T043,T049 | 憲法語意需修正（見 C1）。 |
| mandatory-tests | 是 | T009,T010,T011,T012,T023,T024,T025,T033,T034,T035,T036,T044,T045 | — |
| duplicate-word-handling | 是 | T023,T025,T026,T028,T030,T032 | — |

**憲法對齊問題**

- C1：FR-015 需調整以符合憲法第 VIII 條「Storybook UI 一致性」。

**未對應需求的任務**

- T052、T053 目前未對應明確需求，需釐清是否必要或修訂說明。

**指標統計**
- 總需求數：17
- 總任務數：53
- 覆蓋率：94%（1 項未覆蓋，3 項部分覆蓋）
- 含糊項目：2
- 重複項目：0
- 嚴重問題：1

**後續行動建議**
- 優先調整 FR-015 與相關文件以符合憲法，再進入 `/implement`。
- 擴充 plan.md，使任務得以追溯計畫階段與順序。
- 為 FR-004、FR-006、FR-009、FR-011 補齊任務與測試。
- 統一步驟或命令所依據的 OpenAPI 檔案路徑與副檔名。
- 明確定義模糊的性能與門檻條件，確保測試可重現。

**是否需要補救建議？**
若需要，我可以提供前述待修正項目的具體修改方案，請告知。
