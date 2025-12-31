---
title: "目錄結構規劃提案（依據 PRD + Prototype）"
summary: "比較多種專案結構方案與命名切片，作為 monorepo 佈局參考。"
---

# 目錄結構規劃提案（依據 PRD + Prototype）

## PRD/Prototype 對應切片（命名建議）
- auth：歡迎/登入、第三方登入、條款
- deck：牌組列表、牌組新增、牌組概況
- card：牌組內卡片列表、卡片新增/編輯、AI 生成、例句/翻譯
- study：學習模式、進度、知道/不知道、收藏
- settings：偏好、提醒、主題、音效、匯出、登出
- support：使用說明與協助（設定介面）
- integrations：AI、TTS、通知、匯出（後端）

## 版本 C：專案＋套件型（App-Centric + Packages）
- 核心理念：保持 apps 內部完整閉環，跨專案共用集中在 packages。
- 適用情境：前後端節奏不同、共用較少、快速交付優先。
- 優點：apps 自足、變更範圍可控、共用套件集中管理。
- 風險／缺點：跨 app 重複結構多、共用抽象容易被低估。
- OpenAPI 產物：`apps/api/openapi/` 產出 `openapi.json`，前端 client 生成至 `packages/api-client/src/generated/`，`apps/web` 直接使用生成 client。
- 目錄示意：
  ```
  flashmind/
  ├── apps/
  │   ├── web/
  │   │   └── src/
  │   │       ├── app/
  │   │       │   ├── routes/
  │   │       │   │   ├── auth.routes.ts
  │   │       │   │   ├── deck.routes.ts
  │   │       │   │   ├── study.routes.ts
  │   │       │   │   └── settings.routes.ts
  │   │       │   ├── pages/
  │   │       │   │   ├── welcome/
  │   │       │   │   ├── login/
  │   │       │   │   ├── deck-list/
  │   │       │   │   ├── deck-create/
  │   │       │   │   ├── deck-detail/
  │   │       │   │   ├── card-list/
  │   │       │   │   ├── card-editor/
  │   │       │   │   ├── study-session/
  │   │       │   │   └── settings/
  │   │       │   ├── components/
  │   │       │   │   ├── deck/
  │   │       │   │   ├── card/
  │   │       │   │   ├── study/
  │   │       │   │   └── settings/
  │   │       │   ├── state/
  │   │       │   │   ├── auth.store.ts
  │   │       │   │   ├── deck.store.ts
  │   │       │   │   ├── card.store.ts
  │   │       │   │   └── study.store.ts
  │   │       │   └── shared/
  │   │       │       ├── layouts/
  │   │       │       ├── guards/
  │   │       │       ├── utils/
  │   │       │       └── types/
  │   │       └── styles/
  │   ├── api/
  │       ├── openapi/
  │       │   └── openapi.json
  │       ├── src/
  │       │   ├── modules/
  │       │   │   ├── auth/
  │       │   │   │   ├── controllers/
  │       │   │   │   ├── services/
  │       │   │   │   ├── dto/
  │       │   │   │   └── strategies/
  │       │   │   ├── users/
  │       │   │   │   ├── controllers/
  │       │   │   │   ├── services/
  │       │   │   │   └── dto/
  │       │   │   ├── deck/
  │       │   │   │   ├── controllers/
  │       │   │   │   ├── services/
  │       │   │   │   ├── dto/
  │       │   │   │   └── entities/
  │       │   │   ├── card/
  │       │   │   │   ├── controllers/
  │       │   │   │   ├── services/
  │       │   │   │   ├── dto/
  │       │   │   │   └── entities/
  │       │   │   ├── study/
  │       │   │   │   ├── controllers/
  │       │   │   │   ├── services/
  │       │   │   │   ├── scheduler/
  │       │   │   │   └── dto/
  │       │   │   ├── settings/
  │       │   │   │   ├── controllers/
  │       │   │   │   ├── services/
  │       │   │   │   └── dto/
  │       │   │   ├── notifications/
  │       │   │   │   └── services/
  │       │   │   ├── ai/
  │       │   │   │   └── services/
  │       │   │   ├── tts/
  │       │   │   │   └── services/
  │       │   │   └── export/
  │       │   │       └── services/
  │       │   ├── common/
  │       │   │   ├── guards/
  │       │   │   ├── interceptors/
  │       │   │   ├── filters/
  │       │   │   └── pipes/
  │       │   └── prisma/
  │       │       ├── prisma.service.ts
  │       │       └── prisma.module.ts
  │       └── prisma/
  │           ├── schema.prisma
  │           └── migrations/
  │   └── docs-viewer/
  │       └── src/
  │           └── content/
  │               └── docs/
  ├── packages/
  │   ├── api-client/
  │   │   ├── src/
  │   │   │   ├── generated/
  │   │   │   └── index.ts
  │   │   └── README.md
  │   ├── shared/
  │   │   └── src/
  │   │       ├── types/
  │   │       ├── dto/
  │   │       ├── validators/
  │   │       └── constants/
  │   ├── ui/
  │   │   └── src/
  │   │       ├── primitives/
  │   │       ├── molecules/
  │   │       ├── organisms/
  │   │       ├── forms/
  │   │       └── styles/
  │   └── config/
  └── prototype/
  ```
