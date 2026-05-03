## 1. Contract / Types

- [x] 1.1 更新 `openapi/api.yaml` 的 `CollectionSuggestedCard` schema，支援 `front`、`meanings[]`、`reason`、`existingCardId` 等前端建立快閃卡所需欄位
- [x] 1.2 確認 `CollectionChatMessageResult.suggestedCards` 使用更新後 schema，且 wrapper response 與 operationId 維持既有規範
- [x] 1.3 重新產生 `packages/api-client`，並修正前端引用的產生型別

## 2. Backend AI Provider

- [x] 2.1 先補 `codex-collection-ai.provider.spec.ts`：已存在單字不得出現在 `suggestedCards`
- [x] 2.2 先補 provider 測試：主要單字缺卡時可回傳 `suggestedCards`，且每筆候選包含 `front` 與 `meanings`
- [x] 2.3 先補 provider 測試：`TRANSLATE_ONLY`、純聊天、口說情境不得回傳 `suggestedCards`
- [x] 2.4 更新 Codex output JSON schema，讓 `suggestedCards` 對齊新增 contract 並符合 strict schema required 規則
- [x] 2.5 更新 Codex prompt，要求先查既有單字卡，只針對主要且缺少的單字產生候選，不為功能字或低價值單字湊數
- [x] 2.6 更新 parse / normalize 邏輯，清洗 `suggestedCards` 欄位並丟棄無效候選

## 3. Backend Service / Persistence

- [x] 3.1 先補 `collection.service.spec.ts`：聊天 AI 回覆中的 `suggestedCards` 會保存於 assistant message metadata
- [x] 3.2 先補 service 測試：聊天 API 回傳 `suggestedCards` 時不得建立 Card 或 CardMeaning
- [x] 3.3 更新 collection service response mapping，讓重新載入 session 時可呈現先前單字候選
- [x] 3.4 確認 collection tool service 搜尋卡片可支援英文單字與中文語意查詢，必要時補測試避免 `price` 這類已學字被判成缺卡

## 4. Frontend Domain / Store

- [x] 4.1 新增或擴充收藏包 domain helper，將 `suggestedCards` 轉為單字候選 view model
- [x] 4.2 先補 domain/helper 測試：單字候選可區分可新增、已存在、正在新增、已加入、失敗狀態
- [x] 4.3 先補 localStorage helper 測試：有效 deck id 會預選，無效 deck id 會被忽略或清除
- [x] 4.4 更新收藏包 store，送出聊天訊息後保留並呈現 `suggestedCards`
- [x] 4.5 更新收藏包 store，處理新增單字成功與失敗後的候選狀態

## 5. Frontend UI

- [x] 5.1 新增單字候選卡元件或在收藏包新增頁中拆出可測試區塊，顯示正面、中文解釋/原因與狀態
- [x] 5.2 在新增收藏聊天頁把「可收藏表達」與「建議新增單字」分區呈現；空陣列時不顯示空區塊
- [x] 5.3 實作單字候選加號，開啟牌組選擇 UI，並載入使用者可用牌組
- [x] 5.4 實作牌組選擇的 localStorage 記憶與預選，並處理牌組不存在的情境
- [x] 5.5 將選定牌組與候選資料帶入既有新增快閃卡表單，預填 `front` 與 `meanings`
- [x] 5.6 確保新增快閃卡彈窗或 sheet 在小螢幕可滾動，且取消/儲存按鈕可操作
- [x] 5.7 新增卡片成功後回到收藏包聊天上下文，並把對應候選更新為已加入

## 6. Verification

- [x] 6.1 執行後端 collection / card 相關單元測試
- [x] 6.2 執行前端 collection / card domain 相關測試
- [x] 6.3 執行 TypeScript build 或專案既有檢查指令，確認 API client 與 Angular 型別通過
- [x] 6.4 手動驗證情境：缺少主要單字會出現單字候選，已存在單字不出現候選，純翻譯與口說情境不出現候選
- [x] 6.5 手動驗證情境：選牌組後開啟新增快閃卡、預填欄位、可取消、可成功新增並更新候選狀態
