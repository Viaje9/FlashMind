## 1. 契約與資料模型

- [x] 1.1 在 OpenAPI 新增主題對話的建立、歷史、詳情、訊息、提示與重練 endpoints 及 schemas
- [x] 1.2 以 Prisma schema 與 migration 新增主題、場次、訊息及文法修正資料模型
- [x] 1.3 重新產生 API client 並確認 operationId 對應方法可用
- [x] 1.4 在 OpenAPI 新增主題對話訊息 SSE endpoint

## 2. 後端 TDD 與功能

- [x] 2.1 先建立 service 測試，涵蓋新主題排除／重試、訊息修正、提示、歷史授權與重練
- [x] 2.2 實作結構化 AI provider，支援建立主題、延續對話與按需提示
- [x] 2.3 實作主題對話 service，使 2.1 測試通過
- [x] 2.4 實作 DTO、controller、module 與 controller 測試，並掛入 AppModule
- [x] 2.5 先補 service 串流測試，再實作結構化 AI reply delta 與 SSE controller
- [x] 2.6 先補 prompt policy 測試，再將開場、回覆、修正與提示固定為 CEFR B1

## 3. 前端 TDD 與介面

- [x] 3.1 先建立 domain 測試，涵蓋修正顯示、歷史摘要及 API mapping
- [x] 3.2 實作 Signal store，串接新建、載入、送訊息、提示、歷史與重練 API
- [x] 3.3 實作主題對話頁與頁面專屬對話元件，包含自由輸入、分離修正與按需提示
- [x] 3.4 實作歷史頁與頁面專屬列表元件，包含查看、繼續及再練一次
- [x] 3.5 新增路由、首頁學習入口與首頁偏好支援，補齊互動元素 testId
- [x] 3.6 先補 store optimistic／stream 測試，再重做手機 composer、清空時機與底部留白

## 4. 驗證

- [x] 4.1 執行 Prisma generate、後端測試、前端測試、API／Web build 與 OpenSpec 驗證並修正問題
- [x] 4.2 執行主題對話測試、API／Web build，並以手機 viewport 驗證串流與遮擋
