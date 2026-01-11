# Feature Specification: 帳號與登入

**Feature Branch**: `001-account-auth`  
**Created**: 2026-01-11  
**Status**: Draft  
**Input**: User description: "幫我根據 apps/docs-viewer/src/content/docs/features/P0-account-auth.md 建立第一份規格"  
**語言要求**: 本文件所有內容必須使用繁體中文（zh-tw）

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 新用戶註冊並進入主介面 (Priority: P1)

新用戶能以 Email 或 Google 註冊，成功後自動登入並進入主介面。

**Why this priority**: 使用 FlashMind 的前提是擁有可用帳號，註冊是整體體驗的起點。

**Independent Test**: 以訪客身分完成註冊流程並成功進入主介面，即可驗證此故事的價值。

**Acceptance Scenarios**:

1. **Given** 使用者為訪客且尚未有帳號，**When** 以 Email 註冊並輸入有效資料送出，**Then** 註冊成功、自動登入並導向主介面
2. **Given** 使用者為訪客且尚未有帳號，**When** 選擇 Google 註冊並完成授權，**Then** 註冊成功、自動登入並導向主介面
3. **Given** 使用者正在註冊頁，**When** 檢視頁面內容，**Then** 可看到服務條款與隱私權政策連結且可開啟

---

### User Story 2 - 既有用戶登入並進入主介面 (Priority: P2)

既有用戶能以 Email + 密碼或 Google 登入，成功後進入主介面，失敗時獲得清楚提示。

**Why this priority**: 回訪用戶是主要使用情境，登入成功與清楚錯誤回饋能降低流失。

**Independent Test**: 以既有帳號完成登入並導向主介面，或輸入錯誤資訊能看到錯誤提示。

**Acceptance Scenarios**:

1. **Given** 使用者已有帳號且已登出，**When** 輸入正確 Email + 密碼登入，**Then** 登入成功並導向主介面
2. **Given** 使用者已有帳號且已登出，**When** 以 Google 登入並完成授權，**Then** 登入成功並導向主介面
3. **Given** 使用者嘗試登入，**When** 輸入錯誤帳密或授權失敗，**Then** 顯示可理解的錯誤訊息且可再次嘗試

---

### User Story 3 - 使用者登出並回到歡迎頁 (Priority: P3)

已登入使用者能從設定頁登出，清除登入狀態並回到歡迎頁。

**Why this priority**: 登出是帳號安全與共享裝置情境的必要功能。

**Independent Test**: 登入後在設定頁執行登出，確認導向歡迎頁且無法直接存取主介面。

**Acceptance Scenarios**:

1. **Given** 使用者已登入並進入設定頁，**When** 點選登出，**Then** 登出成功、登入狀態清除並導向歡迎頁
2. **Given** 使用者已登出，**When** 嘗試進入主介面，**Then** 系統導向歡迎頁

### Edge Cases

- 註冊時 Email 已被使用，系統需提示可用替代方案（改用登入或更換 Email）
- 註冊時 Email 格式不正確或密碼未達 8 字元，系統顯示明確提示
- 登入時密碼錯誤或帳號不存在，系統顯示不洩露敏感資訊的錯誤訊息
- Google 授權被取消或失敗時，系統顯示錯誤訊息並允許再次嘗試
- 登出時登入狀態已失效，仍導向歡迎頁且不影響使用者操作

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統必須提供 Email 註冊流程，Email 需符合常見格式且密碼至少 8 字元，未通過時顯示提示
- **FR-002**: 系統必須支援 Google 註冊，首次授權成功後建立帳號並視為登入成功
- **FR-003**: 註冊成功後系統必須自動登入並導向主介面
- **FR-004**: 註冊與登入頁面必須顯示服務條款與隱私權政策連結
- **FR-005**: 系統必須提供 Email + 密碼登入
- **FR-006**: 登入成功後系統必須導向主介面
- **FR-007**: 登入失敗時系統必須顯示可理解的錯誤訊息並允許再次嘗試
- **FR-008**: 設定頁面必須提供登出選項
- **FR-009**: 登出後系統必須清除本地登入狀態並導向歡迎頁
- **FR-010**: 未登入使用者嘗試存取主介面時，系統必須導向歡迎頁

### Key Entities *(include if feature involves data)*

- **使用者帳號**: 代表可登入的使用者，包含 Email、登入方式、建立時間與狀態
- **登入狀態**: 代表目前是否已登入，包含最近登入時間與登入方式

## Assumptions

- 僅支援 Email 與 Google 兩種註冊/登入方式
- 不包含 Email 驗證、忘記密碼或重設密碼流程
- 主介面、歡迎頁、服務條款與隱私權政策頁面已存在且可被導向

## Dependencies

- 主介面與歡迎頁可被導向且具備清楚入口
- 服務條款與隱私權政策頁面可被開啟

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 90% 以上的新用戶可在 3 分鐘內完成註冊並進入主介面
- **SC-002**: 95% 的登入嘗試可在 10 秒內完成並導向主介面
- **SC-003**: 90% 以上的使用者在第一次嘗試內完成登入或收到清楚可理解的錯誤訊息
- **SC-004**: 使用者登出後 5 秒內返回歡迎頁的成功率達 99% 以上
