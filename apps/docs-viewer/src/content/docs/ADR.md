---
title: "架構決策紀錄 (ADR)"
summary: "記錄 FlashMind 專案的關鍵技術架構決策及其背景與理由。"
---

# 架構決策紀錄 (ADR)

| 版本 | 日期 | 作者 | 變更說明 |
|------|------|------|----------|
| 1.0  | 2026-01-16 | — | 初版建立 |
| 1.1  | 2026-01-17 | — | 新增 ADR-011~013：狀態管理、元件組織、目錄結構 |
| 1.2  | 2026-01-17 | — | ADR-011 改為 Signal Stores；ADR-012 加入共置原則 |
| 1.3  | 2026-01-17 | — | ADR-012 加入 Domain 層（Pure Function 商業邏輯） |
| 1.4  | 2026-01-17 | — | ADR-012 加入業務元件放置規則；新增 ADR-014 UI 元件庫設計 |
| 1.5  | 2026-01-17 | — | ADR-008 改為 Azure OpenAI；新增 ADR-015 TTS 語音合成服務 |
| 1.6  | 2026-01-17 | — | 新增 ADR-016 API 設計規範 |

---

## ADR-001：採用 Monorepo 架構搭配 pnpm Workspace

### 狀態

已採用

### 背景

FlashMind 需要同時維護前端 (Web App)、後端 (API Server)、共用套件 (API Client) 以及文件站台。需要一種專案結構能有效管理這些子專案間的依賴關係與程式碼共享。

### 決策

採用 pnpm workspace 管理 Monorepo 架構：

```
flashmind/
├── apps/
│   ├── web/          # Angular PWA 前端
│   ├── api/          # NestJS 後端
│   └── docs-viewer/  # 文件站台
├── packages/
│   └── api-client/   # 自動生成的 API Client
└── openapi/          # OpenAPI 契約定義
```

### 理由

- **程式碼共享**：`@flashmind/api-client` 可由前端直接引用
- **版本一致性**：共用依賴統一管理，避免版本衝突
- **開發效率**：單一 repo 便於跨專案重構與原子性提交
- **pnpm 優勢**：硬連結節省磁碟空間，安裝速度快

### 替代方案

| 方案 | 評估 |
|------|------|
| 多 Repo 分離 | 維護成本高，跨專案變更需協調多個 PR |
| npm/yarn workspace | 功能相當，但 pnpm 在效能與磁碟使用上更優 |

---

## ADR-002：前端框架選用 Angular 21

### 狀態

已採用

### 背景

需要選擇一個適合建構企業級 PWA 應用的前端框架，要求：
- 良好的 TypeScript 支援
- 成熟的生態系統
- 適合長期維護

### 決策

採用 Angular 21 作為前端框架，搭配：
- Tailwind CSS v4：實用優先的 CSS 框架
- Storybook：元件開發與文件化

### 理由

- **完整性**：Angular 內建路由、表單、HTTP Client，減少技術選型決策
- **TypeScript 原生**：從設計之初即以 TypeScript 為核心
- **Signals**：Angular 21 的 Signals API 提供更直覺的反應式狀態管理
- **長期支援**：Google 維護，有明確的 LTS 政策

### 替代方案

| 方案 | 評估 |
|------|------|
| React | 生態豐富但需額外選擇路由、狀態管理等工具 |
| Vue | 學習曲線平緩，但企業級專案經驗較少 |
| SvelteKit | 效能優異，但生態系統仍在成熟中 |

---

## ADR-003：後端框架選用 NestJS

### 狀態

已採用

### 背景

需要一個結構化、可擴展的 Node.js 後端框架，支援：
- 依賴注入
- 模組化架構
- 良好的 TypeScript 支援

### 決策

採用 NestJS 作為後端框架。

### 理由

- **架構一致性**：模組/控制器/服務的結構與 Angular 類似，降低學習成本
- **依賴注入**：內建 DI 容器，便於測試與解耦
- **豐富生態**：官方支援 TypeORM、Prisma、GraphQL 等整合
- **企業級設計**：適合建構可維護的中大型應用

### 替代方案

| 方案 | 評估 |
|------|------|
| Express | 輕量但缺乏結構，大型專案難以維護 |
| Fastify | 效能優異，但架構支援不如 NestJS 完整 |
| tRPC | 適合全端 TypeScript，但彈性較低 |

---

## ADR-004：資料庫 ORM 選用 Prisma

### 狀態

已採用

### 背景

需要一個類型安全的 ORM 工具，提供：
- 自動產生 TypeScript 類型
- 直覺的查詢 API
- 資料庫遷移管理

### 決策

採用 Prisma 作為 ORM。

### 理由

- **類型安全**：根據 schema 自動產生 TypeScript 類型
- **直覺的 API**：`prisma.user.findMany()` 比原生 SQL 更易讀
- **遷移管理**：`prisma migrate` 提供版本化的 schema 變更
- **開發體驗**：Prisma Studio 提供視覺化資料瀏覽

### 替代方案

| 方案 | 評估 |
|------|------|
| TypeORM | 功能完整，但類型推導不如 Prisma 直覺 |
| Drizzle | 更輕量且效能好，但生態較新 |
| Knex | 靈活但缺乏自動類型產生 |

---

## ADR-005：間隔重複演算法選用 FSRS

### 狀態

已採用

### 背景

FlashMind 的核心功能是間隔重複學習。需要選擇一個高效的排程演算法：
- 比傳統 SM-2 更高的記憶效率
- 開源可用
- 有 TypeScript 實作

### 決策

採用 FSRS（Free Spaced Repetition Scheduler）演算法，使用 [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) 套件。

### 理由

- **科學基礎**：基於記憶研究的數學模型，經過實證驗證
- **效率更高**：相比 SM-2，能以更少的複習次數達到相同的記憶效果
- **開源實作**：ts-fsrs 提供完整的 TypeScript 支援
- **差異化**：這是與 Anki (SM-2) 的核心差異點

### 替代方案

| 方案 | 評估 |
|------|------|
| SM-2 | 經典演算法，但已有 30 年歷史，效率不如 FSRS |
| Leitner System | 實作簡單，但排程精確度較低 |
| 自行設計 | 開發成本高，缺乏實證基礎 |

### 參考資料

- [FSRS 演算法說明](https://github.com/open-spaced-repetition/fsrs4anki)
- [ts-fsrs GitHub](https://github.com/open-spaced-repetition/ts-fsrs)

---

## ADR-006：應用形態選用 PWA

### 狀態

已採用

### 背景

FlashMind 定位為行動優先的應用，目標用戶主要在通勤等碎片時間使用手機學習。需要決定應用的發布形態。

### 決策

採用 Progressive Web App (PWA) 架構，而非原生 App。

### 理由

- **跨平台**：單一程式碼庫支援 iOS、Android、桌面瀏覽器
- **免安裝**：用戶可直接透過瀏覽器使用，降低使用門檻
- **可安裝**：支援 Add to Home Screen，接近原生體驗
- **離線支援**：Service Worker 快取核心功能
- **開發效率**：無需維護多個原生專案
- **更新即時**：無需經過 App Store 審核

### 缺點與緩解

| 缺點 | 緩解措施 |
|------|----------|
| iOS PWA 功能受限 | 聚焦核心功能，避免依賴 iOS 不支援的 API |
| 無法上架 App Store | 未來可考慮 Capacitor 包裝 |
| 推播通知需授權 | 提供清楚的授權引導 |

### 替代方案

| 方案 | 評估 |
|------|------|
| React Native | 跨平台但開發成本較高 |
| Flutter | 效能好但團隊需學習 Dart |
| 原生 App | 體驗最佳但維護成本高 |

---

## ADR-007：API 契約驅動開發 (Contract-First)

### 狀態

已採用

### 背景

前後端分離開發時，需要確保 API 介面的一致性，避免溝通成本與整合問題。

### 決策

採用 OpenAPI 3.0 規範定義 API 契約，並使用 openapi-generator-cli 自動產生 TypeScript Angular Client。

```
openapi/api.yaml
    ↓ openapi-generator-cli
packages/api-client/src/generated/
```

### 理由

- **單一真相來源**：OpenAPI 規範作為前後端溝通的唯一依據
- **自動化**：減少手動撰寫 API Client 的錯誤
- **文件即程式碼**：API 規範本身就是文件
- **並行開發**：前後端可根據契約同時開發

### 替代方案

| 方案 | 評估 |
|------|------|
| Code-First | 後端先實作再產生文件，容易不同步 |
| GraphQL | 類型安全但增加複雜度 |
| tRPC | 需要全端 TypeScript，限制後端技術選擇 |

---

## ADR-008：AI 內容生成服務整合

### 狀態

已採用

### 背景

FlashMind 的核心差異化功能之一是 AI 自動生成卡片內容（詞義、例句）。需要選擇合適的 AI 服務。

### 決策

採用 **Azure OpenAI Service** 作為 AI 內容生成服務：
- 不限定特定模型，可根據需求部署 GPT-4o、GPT-4、GPT-3.5 Turbo 等
- 初期不實作多服務提供者抽象，但設計時預留擴展空間

### 理由

- **品質**：GPT-4 系列模型在語言生成任務上表現優異
- **企業級保障**：Azure 提供 SLA、合規性認證、資料落地保證
- **彈性**：可根據需求部署不同模型，控制成本與效能平衡
- **整合便利**：未來可與其他 Azure 服務（如 Azure AD、Application Insights）整合

### 技術細節

| 項目 | 說明 |
|------|------|
| 端點格式 | `https://{resource}.openai.azure.com/` |
| 認證方式 | API Key 或 Azure AD（建議生產環境用 Azure AD） |
| 模型指定 | 透過 deployment name，非直接指定模型名稱 |

### 風險與緩解

| 風險 | 緩解措施 |
|------|----------|
| 生成品質不佳 | 用戶可編輯生成內容；持續優化 prompt |
| API 成本過高 | 設定每日生成上限；監控用量 |
| 服務中斷 | Azure 提供 SLA；未來可擴展支援其他服務提供者 |

---

## ADR-009：樣式框架選用 Tailwind CSS v4

### 狀態

已採用

### 背景

需要一個高效的 CSS 解決方案，支援：
- 快速原型開發
- 一致的設計系統
- 良好的維護性

### 決策

採用 Tailwind CSS v4 作為樣式框架。

### 理由

- **實用優先**：直接在 HTML 中使用 utility class，減少 CSS 檔案切換
- **設計系統**：內建的 spacing、color、typography 系統確保一致性
- **效能**：JIT 編譯只產生使用到的樣式
- **行動優先**：響應式斷點設計直覺

### 替代方案

| 方案 | 評估 |
|------|------|
| Angular Material | 元件豐富但客製化困難 |
| SCSS 手寫 | 靈活但維護成本高 |
| CSS-in-JS | 與 Angular 整合不如 React 生態自然 |

---

## ADR-010：元件開發採用 Storybook

### 狀態

已採用

### 背景

需要一個工具來：
- 獨立開發 UI 元件
- 建立元件文件
- 進行視覺測試

### 決策

採用 Storybook 作為元件開發與文件工具。

### 理由

- **隔離開發**：不需執行整個應用即可開發元件
- **自動文件**：根據元件的 props 自動產生文件
- **視覺回歸測試**：搭配 Chromatic 可進行視覺差異測試
- **無障礙測試**：@storybook/addon-a11y 協助檢測無障礙問題

---

## ADR-011：前端狀態管理選用 Angular Signal Stores

### 狀態

已採用

### 背景

FlashMind 前端需要管理多種狀態：

- 用戶認證狀態
- 牌組與卡片資料
- 學習進度與 FSRS 排程
- UI 狀態（載入中、錯誤、表單）

需要選擇一個可擴展、可預測的狀態管理方案。

### 決策

採用 Angular 原生 Signals 搭配 Signal Store 模式作為狀態管理解決方案。

```typescript
// apps/web/src/app/state/auth.store.ts
import { signal, computed } from '@angular/core';

export const authStore = {
  // State
  user: signal<User | null>(null),
  isLoading: signal(false),
  error: signal<string | null>(null),

  // Computed
  isAuthenticated: computed(() => authStore.user() !== null),

  // Actions
  login: async (credentials: LoginDto) => { ... },
  logout: () => { ... },
};
```

目錄結構：

```text
apps/web/src/app/
├── state/
│   ├── auth.store.ts
│   ├── deck.store.ts
│   ├── card.store.ts
│   └── study.store.ts
```

### 理由

- **原生整合**：Signals 是 Angular 21 的核心功能，與框架深度整合
- **輕量簡潔**：無需額外套件，零樣板程式碼
- **效能優異**：細粒度反應式更新，減少不必要的變更檢測
- **學習曲線低**：直覺的 API，團隊容易上手
- **未來導向**：Angular 官方推薦的狀態管理方向

### 替代方案

| 方案 | 評估 |
|------|------|
| NgRx | 功能完整但樣板程式碼多，對此專案規模過重 |
| @ngrx/signals | 結合 NgRx 與 Signals，但增加依賴 |
| Services + BehaviorSubject | 傳統做法，但 Signals 更直覺 |
| NGXS | 較簡潔的 Redux，但仍有額外學習成本 |

### 注意事項

- 對於複雜的非同步流程，可搭配 RxJS 的 `toSignal()` / `toObservable()`
- Store 檔案與對應的領域元件共置（見 ADR-012），而非集中在獨立的 `state/` 目錄

---

## ADR-012：前端元件按領域分組與共置原則

### 狀態

已採用

### 背景

隨著專案成長，需要一個清晰的元件組織策略：

- 便於找到相關元件
- 降低耦合
- 支援團隊分工
- 狀態管理、表單邏輯、商業邏輯需要有明確的放置位置

### 決策

採用 **Colocation（共置）** 原則，按業務領域組織元件，並將 Domain、Store、Form 放在對應的領域目錄中：

```text
apps/web/src/app/components/
├── auth/                       # 登入/註冊領域
│   ├── auth.domain.ts          # 商業邏輯（驗證規則、權限判斷）
│   ├── auth.store.ts           # 狀態管理（用戶、登入狀態）
│   ├── auth.form.ts            # 表單定義（登入、註冊表單）
│   ├── login/
│   │   └── login.component.ts
│   └── register/
│       └── register.component.ts
├── deck/                       # 牌組領域
│   ├── deck.domain.ts          # 商業邏輯（統計計算、進度計算）
│   ├── deck.store.ts           # 牌組狀態
│   ├── deck.form.ts            # 牌組表單（新增、編輯）
│   ├── deck-list/
│   ├── deck-create/
│   └── deck-detail/
├── card/                       # 卡片領域
│   ├── card.domain.ts          # 商業邏輯（卡片驗證、詞義處理）
│   ├── card.store.ts           # 卡片狀態
│   ├── card.form.ts            # 卡片表單（含動態詞義區塊）
│   ├── card-editor/
│   └── card-list/
├── study/                      # 學習領域
│   ├── study.domain.ts         # 商業邏輯（FSRS 計算、排程規則）
│   ├── study.store.ts          # 學習進度狀態
│   ├── study-session/
│   └── study-complete/
├── settings/                   # 設定領域
│   └── settings.form.ts
└── shared/                     # 跨領域共用
    ├── ui/                     # 共用 UI 元件
    │   ├── button/
    │   ├── input/
    │   └── dialog/
    └── layouts/                # 版面配置
```

### 分層架構

每個領域包含四種檔案類型，各有明確職責：

| 層級 | 檔案 | 職責 | 特性 |
|------|------|------|------|
| Domain | `*.domain.ts` | 商業邏輯、規則判斷 | Pure function、可 throw error、無框架依賴 |
| Store | `*.store.ts` | 狀態管理、API 呼叫 | 使用 Angular Signals、呼叫 Domain |
| Form | `*.form.ts` | 表單結構、欄位驗證 | 使用 Reactive Forms |
| Component | `*.component.ts` | UI 渲染、使用者互動 | 使用 Store 與 Form |

### Domain 層設計原則

Domain 層專注於純商業邏輯，遵循以下原則：

- **Pure Function**：相同輸入必定產生相同輸出
- **可 throw error**：用於表達商業規則違反
- **無框架依賴**：不使用 Angular、RxJS 等框架 API
- **無 utility 依賴**：不直接使用時間套件等工具（由呼叫端傳入）
- **易於測試**：不需 mock，直接單元測試

### Domain 層範例

```typescript
// study.domain.ts
import type { Card, Rating, SchedulingResult } from './study.types';

/** 計算下次複習時間（FSRS 核心邏輯） */
export function calculateNextReview(
  card: Card,
  rating: Rating,
  now: Date
): SchedulingResult {
  if (rating < 1 || rating > 4) {
    throw new Error('Rating must be between 1 and 4');
  }
  // FSRS 計算邏輯...
  return { nextDue, interval, stability };
}

/** 判斷卡片是否需要今日複習 */
export function isDueToday(card: Card, today: Date): boolean {
  return card.nextDue <= today;
}

/** 計算本次學習的卡片順序（待複習優先） */
export function sortCardsForStudy(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (a.isNew !== b.isNew) return a.isNew ? 1 : -1;
    return a.stability - b.stability;
  });
}
```

```typescript
// study.store.ts
import { signal } from '@angular/core';
import { calculateNextReview, sortCardsForStudy } from './study.domain';

export const studyStore = {
  cards: signal<Card[]>([]),
  currentIndex: signal(0),

  startSession: (cards: Card[]) => {
    const sorted = sortCardsForStudy(cards);  // 呼叫 Domain
    studyStore.cards.set(sorted);
    studyStore.currentIndex.set(0);
  },

  submitRating: async (rating: Rating) => {
    const card = studyStore.cards()[studyStore.currentIndex()];
    const result = calculateNextReview(card, rating, new Date());  // 呼叫 Domain
    await api.updateCardSchedule(card.id, result);
    // 更新狀態...
  },
};
```

### 檔案命名規範

| 檔案類型 | 命名規則 | 範例 |
|----------|----------|------|
| Domain | `{domain}.domain.ts` | `study.domain.ts` |
| Store | `{domain}.store.ts` | `auth.store.ts` |
| Form | `{domain}.form.ts` | `card.form.ts` |
| Component | `{name}.component.ts` | `login.component.ts` |

### 理由

- **高內聚**：一個領域的所有檔案（Domain、Store、Form、Component）都在同一目錄
- **易於測試**：Domain 層為 pure function，可直接單元測試，無需 mock
- **易於導航**：開發某功能時不需在多個目錄間切換
- **易於重構**：刪除或搬移整個功能只需處理一個目錄
- **與後端對齊**：前後端使用相同的領域切分（auth、deck、card、study）
- **可移植性**：Domain 層不依賴框架，未來換框架時商業邏輯無需修改
- **職責清晰**：每層有明確的單一職責

### 替代方案

| 方案 | 評估 |
|------|------|
| 集中式（state/、forms/ 獨立目錄） | 需在多個目錄間跳轉，關聯性不明顯 |
| 按類型分組 (dialogs/, forms/) | 跨領域元件混雜，難以判斷影響範圍 |
| Atomic Design | 適合 UI 元件庫，但業務邏輯切分不清 |
| 商業邏輯放 Store | Store 職責過重，且難以測試 |

### 業務元件放置規則

業務相關的元件依據是否共用，放置在不同位置：

| 元件類型 | 放置位置 | 說明 |
|----------|----------|------|
| 通用 UI 元件 | `packages/ui/` | 無業務邏輯，純 UI（見 ADR-014） |
| 共用業務元件 | `components/{domain}/` | 多個頁面會用到 |
| 頁面專屬元件 | `pages/{page}/components/` | 只有該頁面用到 |

**共用業務元件** - 多個頁面會用到，放在領域目錄下：

```text
apps/web/src/app/components/
├── user/
│   ├── user.store.ts
│   ├── user-avatar/            # 共用：個人頁、評論區、排行榜都會顯示頭像
│   └── user-badge/             # 共用：多處顯示用戶等級徽章
```

**頁面專屬元件** - 只有該頁面使用，放在頁面自己的 components 資料夾：

```text
apps/web/src/app/pages/
├── leaderboard/
│   ├── leaderboard.component.ts
│   └── components/
│       └── rank-chart/         # 只有排行榜頁面用到的圖表
├── profile/
│   ├── profile.component.ts
│   └── components/
│       └── achievement-grid/   # 只有個人頁用到的成就牆
```

### 注意事項

- 若 Store 需跨領域使用（如 `auth.store` 在其他領域檢查登入狀態），直接 import 即可
- 簡單表單可省略 `.form.ts`，直接在 component 中定義
- 若 Domain 邏輯可跨前後端共用，可抽至 `packages/shared/`
- 當頁面專屬元件開始被其他頁面使用時，應重構至 `components/{domain}/`

---

## ADR-013：專案目錄結構規範

### 狀態

已採用

### 背景

需要明確定義專案各目錄的用途與放置原則，確保團隊成員有一致的理解。

### 決策

採用以下目錄結構：

```text
flashmind/
├── apps/
│   ├── web/                    # Angular PWA 前端
│   │   └── src/app/
│   │       ├── pages/          # 路由頁面元件（薄層，組合 components）
│   │       ├── components/     # 按領域分組，含 domain、store、form（見 ADR-012）
│   │       │   ├── auth/       # *.domain.ts, *.store.ts, *.form.ts, login/, ...
│   │       │   ├── deck/       # *.domain.ts, *.store.ts, *.form.ts, deck-list/, ...
│   │       │   ├── card/       # *.domain.ts, *.store.ts, *.form.ts, card-editor/, ...
│   │       │   ├── study/      # *.domain.ts, *.store.ts, study-session/, ...
│   │       │   └── shared/     # 跨領域共用 UI 元件
│   │       ├── guards/         # 路由守衛
│   │       └── services/       # 跨領域共用服務（HTTP interceptor 等）
│   ├── api/                    # NestJS 後端
│   │   └── src/
│   │       ├── modules/        # 按領域分組的模組
│   │       ├── common/         # 共用 guards、interceptors、pipes
│   │       └── prisma/         # Prisma 服務
│   └── docs-viewer/            # Astro 文件站台
├── packages/
│   ├── api-client/             # 自動生成的 API Client
│   ├── shared/                 # 前後端共用類型與驗證
│   ├── ui/                     # 共用 UI 元件庫（未來）
│   └── config/                 # 共用設定（未來）
├── openapi/                    # OpenAPI 契約定義
│   └── api.yaml                # API 規格
├── openspec/                   # 變更提案管理
│   ├── changes/                # 進行中的變更
│   └── specs/                  # 已歸檔的規格
├── prototype/                  # Figma 匯出的設計稿
└── docs/                       # 專案層級文件
```

### 理由

- **職責分離**：每個目錄有明確的單一職責
- **可擴展性**：結構支援專案成長
- **一致性**：前後端採用相似的模組化結構
- **契約集中**：`openapi/` 存放所有 API 契約，便於管理

### 目錄說明

| 目錄 | 用途 |
|------|------|
| `apps/` | 可獨立部署的應用程式 |
| `packages/` | 跨應用共用的套件 |
| `openapi/` | OpenAPI 契約定義 |
| `openspec/` | 架構變更提案流程 |
| `prototype/` | UI/UX 設計稿 |

---

## ADR-014：UI 元件庫設計（packages/ui）

### 狀態

已採用

### 背景

FlashMind 需要一套統一的 UI 元件庫，提供：

- 一致的視覺風格
- 可重用的基礎元件
- 浮層元件的統一呼叫方式（透過 Service）

### 決策

`packages/ui` 定位為 **Angular UI 元件庫**，採用功能導向分類，可包含元件（Component）與服務（Service）。

### 元件分類

```text
packages/ui/src/lib/
├── primitives/       # 最基礎、不可再分割的元件
│   ├── button/
│   ├── icon-button/
│   ├── badge/
│   ├── divider/
│   └── toggle/
├── layouts/          # 版面配置元件
│   ├── row/
│   ├── column/
│   ├── stack/
│   ├── container/
│   └── spacer/
├── forms/            # 表單輸入相關
│   ├── labeled-input/
│   ├── textarea/
│   ├── number-input/
│   └── checkbox/
├── navigation/       # 導航相關
│   ├── navbar/
│   ├── tabs/
│   ├── breadcrumb/
│   └── back-button/
├── feedback/         # 使用者回饋
│   ├── toast/
│   ├── loading-spinner/
│   └── skeleton/
├── data-display/     # 資料展示
│   ├── card/
│   ├── list-item/
│   ├── avatar/
│   └── stat-card/
└── overlays/         # 浮層元件（含 Service）
    ├── dialog/
    │   ├── dialog.component.ts
    │   └── dialog.service.ts
    ├── drawer/
    ├── popover/
    └── tooltip/
```

### 分類說明

| 分類 | 說明 | 特性 |
|------|------|------|
| primitives | 最基礎的 UI 元素 | 無依賴其他元件 |
| layouts | 控制子元素排列方式 | 用於頁面結構 |
| forms | 表單輸入與控制項 | 支援 Reactive Forms |
| navigation | 頁面間或區塊間導航 | 可能依賴 Router |
| feedback | 向用戶傳達狀態或結果 | 通常是非阻塞式 |
| data-display | 展示資料的容器 | 可搭配 primitives |
| overlays | 浮於頁面之上的元件 | 透過 Service 呼叫 |

### Overlays 使用方式

浮層元件透過 Service 呼叫，而非直接在 template 中使用：

```typescript
import { DialogService } from '@flashmind/ui/overlays';

@Component({ ... })
export class MyComponent {
  private dialogService = inject(DialogService);

  openConfirm() {
    this.dialogService.open(ConfirmDialogComponent, {
      title: '確認刪除？',
      message: '此操作無法復原',
    });
  }
}
```

### 理由

- **功能導向分類**：比 Atomic Design（atoms/molecules/organisms）更直覺，易於定位元件
- **Service 共置**：浮層元件的 Component 與 Service 放在一起，import 時更方便
- **與業務分離**：packages/ui 只放通用 UI，業務元件放在 apps/web/src/app/components/

### 替代方案

| 方案 | 評估 |
|------|------|
| Atomic Design（atoms/molecules/organisms） | 分類標準較主觀，難以判斷元件屬於哪一層 |
| 全部扁平結構 | 元件多時難以管理 |
| Service 放 apps/web/services | 元件與 Service 分離，維護不便 |

### 注意事項

- packages/ui 可包含 Angular 相關程式碼（@Injectable、@Component）
- 業務相關元件不放在 packages/ui，應放在 apps/web/src/app/components/（見 ADR-012）
- 若元件需要跨多個 Angular 專案共用，才放入 packages/ui

---

## ADR-015：TTS 語音合成服務整合

### 狀態

已採用

### 背景

FlashMind 作為語言學習應用，需要提供單字與例句的語音朗讀功能，幫助用戶學習正確發音。

### 決策

依據使用情境採用不同的 TTS 服務：

| 用途 | 服務 | 說明 |
|------|------|------|
| 單字發音 | Google Cloud TTS | 發音精準，適合短詞 |
| 例句朗讀 | Azure Speech Service | 語調自然，適合長句 |

### 理由

- **單字用 Google TTS**：發音清晰準確，支援多語言與多種口音
- **例句用 Azure TTS**：Neural Voice 語調更自然流暢，長句朗讀體驗佳
- **分工互補**：各取所長，提供最佳的學習體驗

### 技術細節

| 服務 | 端點 | 認證方式 |
|------|------|----------|
| Google Cloud TTS | `texttospeech.googleapis.com` | API Key 或 Service Account |
| Azure Speech | `{region}.tts.speech.microsoft.com` | API Key 或 Azure AD |

### 風險與緩解

| 風險 | 緩解措施 |
|------|----------|
| 雙服務增加維護複雜度 | 封裝統一的 TTS Service 介面 |
| API 成本 | 實作快取機制，相同內容不重複呼叫 |
| 服務中斷 | 可考慮互為備援（單字改用 Azure、例句改用 Google） |

---

## ADR-016：API 設計規範

### 狀態

已採用

### 背景

ADR-007 決定採用 OpenAPI 契約驅動開發，但未定義 API 的格式規範。需要統一：

- Request / Response 格式
- 錯誤處理結構
- 分頁機制
- 認證方式
- 命名慣例

### 決策

#### 1. URL 命名

- 資源路徑使用 **kebab-case**
- 資源導向設計，CRUD 操作對應 HTTP Method
- 非 CRUD 動作使用動詞（如 `/auth/login`）

```
GET    /decks                  # 列表
POST   /decks                  # 建立
GET    /decks/:id              # 單一資源
PATCH  /decks/:id              # 部分更新
DELETE /decks/:id              # 刪除
GET    /decks/:id/cards        # 子資源
POST   /auth/login             # 動作
```

#### 2. Request 格式

- Body 與 Query 參數使用 **camelCase**

```json
POST /decks
{
  "name": "日文 N3 單字",
  "isPublic": false
}

GET /decks?sortBy=createdAt&sortOrder=desc
```

#### 3. Response 格式

採用**統一 Wrapper** 結構，所有回應使用 `{ data, meta? }` 包裝：

```typescript
// 單一資源
GET /decks/abc123
→ 200 OK
{
  "data": {
    "id": "abc123",
    "name": "日文 N3 單字",
    "cardCount": 42,
    "createdAt": "2026-01-17T10:30:00Z"
  }
}

// 列表（含分頁 meta）
GET /decks?limit=20
→ 200 OK
{
  "data": [
    { "id": "abc123", "name": "日文 N3 單字", ... },
    { "id": "def456", "name": "英文托福", ... }
  ],
  "meta": {
    "nextCursor": "eyJpZCI6ImRlZjQ1NiJ9",
    "hasMore": true
  }
}

// 建立資源
POST /decks
→ 201 Created
{
  "data": {
    "id": "abc123",
    "name": "日文 N3 單字",
    ...
  }
}

// 無內容操作
DELETE /decks/abc123
→ 204 No Content
```

#### 4. Error 格式

錯誤回應使用 `{ error: { code, message } }` 結構：

```typescript
{
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Email 或密碼錯誤"
  }
}
```

**Error Code 命名規範：**

- 格式：`SCREAMING_SNAKE_CASE`
- 領域錯誤加前綴：`AUTH_`、`DECK_`、`CARD_`

**HTTP Status Code 對應：**

| Status | 用途 | Error Code 範例 |
|--------|------|-----------------|
| 400 | 請求格式錯誤、驗證失敗 | `VALIDATION_ERROR` |
| 401 | 未認證 | `UNAUTHORIZED`, `SESSION_EXPIRED` |
| 403 | 無權限 | `FORBIDDEN` |
| 404 | 資源不存在 | `NOT_FOUND`, `DECK_NOT_FOUND` |
| 409 | 資源衝突 | `EMAIL_ALREADY_EXISTS` |
| 422 | 商業邏輯錯誤 | `DECK_LIMIT_EXCEEDED` |
| 500 | 伺服器錯誤 | `INTERNAL_ERROR` |

#### 5. 分頁機制

採用 **cursor-based** 分頁：

```typescript
// 第一頁
GET /decks?limit=20

→ 200 OK
{
  "data": [...],
  "meta": {
    "nextCursor": "eyJpZCI6ImNsaDEyMzQ1In0=",
    "hasMore": true
  }
}

// 下一頁
GET /decks?limit=20&cursor=eyJpZCI6ImNsaDEyMzQ1In0=
```

- `cursor`：Base64 編碼的識別資訊（通常是 id 或 createdAt）
- `hasMore`：是否還有更多資料
- `nextCursor`：下一頁的 cursor（無更多資料時為 null）

#### 6. 認證機制

採用 **HttpOnly Cookie** 儲存 Session：

```
Set-Cookie: session=<token>; HttpOnly; Secure; SameSite=Strict; Path=/
```

- 前端不需手動處理 token，瀏覽器自動帶上
- 防止 XSS 攻擊竊取 token
- 後端可隨時撤銷 session

#### 7. 時間與 ID 格式

```json
{
  "id": "clh1234567890abcdef",
  "createdAt": "2026-01-17T10:30:00Z",
  "lastLoginAt": null
}
```

- **ID**：cuid 格式（由 Prisma 生成）
- **時間**：ISO 8601 UTC 格式
- **可選時間欄位**：允許 `null`

#### 8. 刪除策略

採用**硬刪除**（Hard Delete），不保留 `deletedAt` 欄位。

#### 9. OpenAPI operationId

每個 endpoint **必須**定義 `operationId`，它決定自動生成的 API client 方法名稱：

```yaml
paths:
  /auth/me:
    get:
      operationId: getCurrentUser  # → authService.getCurrentUser()
```

**命名規範：**

- 格式：camelCase
- 動詞開頭：`get`、`create`、`update`、`delete`、`list`
- 清楚描述動作：`getCurrentUser`、`initiateGoogleOAuth`
- 避免重複路徑資訊：用 `login` 而非 `authLogin`

### 理由

| 決策 | 理由 |
|------|------|
| 統一 Wrapper | 所有回應結構一致，前端處理邏輯統一 |
| 簡化 Error | MVP 階段不需要欄位級錯誤，簡化實作 |
| cursor-based 分頁 | 效能穩定，適合未來資料量成長 |
| HttpOnly Cookie | 比 localStorage 更安全，防止 XSS |
| 硬刪除 | 簡化實作，MVP 階段無需資料還原功能 |

### 替代方案

| 方案 | 評估 |
|------|------|
| 直接回傳資料（無 Wrapper） | 結構不一致，單一資源與列表處理方式不同 |
| Error 含 details 陣列 | 增加複雜度，MVP 階段不需要 |
| offset/limit 分頁 | 大量資料時效能差，資料變動時不穩定 |
| Bearer Token in localStorage | 有 XSS 風險 |
| 軟刪除 | 增加查詢複雜度，MVP 階段不需要 |

---

## 附錄：技術棧總覽

| 層級 | 技術選擇 |
|------|----------|
| 前端框架 | Angular 21 |
| 前端狀態管理 | Angular Signal Stores |
| 前端樣式 | Tailwind CSS v4 |
| 元件開發 | Storybook |
| 後端框架 | NestJS |
| 資料庫 ORM | Prisma |
| 套件管理 | pnpm workspace |
| API 契約 | OpenAPI 3.0 |
| 間隔重複 | FSRS (ts-fsrs) |
| AI 內容生成 | Azure OpenAI Service |
| TTS 語音合成 | Google Cloud TTS / Azure Speech |
| 應用形態 | PWA |

---

## 附錄：決策狀態說明

| 狀態 | 說明 |
|------|------|
| 提議中 | 尚未決定，等待討論 |
| 已採用 | 已決定並實施 |
| 已棄用 | 曾採用但已更換為其他方案 |
| 已取代 | 被新的 ADR 取代 |
