# 收藏包真實資料 100 筆測試報告

日期：2026-05-02

## 測試方式

本次使用正式後端 `CollectionService` 與 `CodexCollectionAiProvider`，讀取本機 DB 中目前使用者的單字卡樣本、相關單字卡與既有收藏搜尋結果，透過 Codex SDK 產生收藏包聊天回覆。

已取得使用者明確同意後執行。測試只送出聊天訊息與保存 chat session/message；沒有模擬按加號，因此沒有把候選正式加入收藏包。

## 總覽

- 測試情境：100 筆
- Chat sessions：6 個
- 成功：100 筆
- 失敗：0 筆
- 頂層候選總數：112 個
- Intent 分布：`analyze_sentence` 47、`translate_only` 4、`correct_sentence` 8、`explain_usage` 7、`find_existing` 5、`suggest_candidates` 29
- 類型分布（含 relatedCandidates）：`sentence` 112、`collocation` 134、`clause` 45、`phrase` 78

## 最慢 10 筆

|   # |  時間 | Intent               | 輸入                                                          |
| --: | ----: | -------------------- | ------------------------------------------------------------- |
|  92 | 32.2s | `suggest_candidates` | 請幫我產生 travel 相關的語塊                                  |
|  45 | 27.2s | `suggest_candidates` | 請幫我產生跟 schedule 有關的語塊                              |
|  99 | 24.7s | `suggest_candidates` | 我想說「請幫我保留一張桌子」                                  |
|  87 | 24.3s | `suggest_candidates` | 我想說「這個流程讓事情更容易」                                |
|  66 | 22.3s | `suggest_candidates` | 請幫我產生跟 deadline 有關的句子和語塊                        |
|  95 | 21.8s | `analyze_sentence`   | 如果今天下大雨，我們就延後行程                                |
|  96 | 21.4s | `analyze_sentence`   | 雖然任務很困難，我們還是準時完成                              |
|  98 | 21.2s | `correct_sentence`   | Can you make this natural: I need to check the room is ready. |
|  75 | 20.4s | `analyze_sentence`   | 雖然房間很小，但位置很方便                                    |
|  89 | 20.2s | `suggest_candidates` | 我想說「我們可能需要外部資源」                                |

## 已存在收藏偵測

- 沒有候選被標示為已存在。

## 逐筆結果

### 1. 我需要在餐廳訂滿之前先訂位

- 結果：成功
- Session：`cmooblfzw0000j8ua1iv5cm5y`
- 耗時：11.7s
- Intent：`analyze_sentence`
- AI 回覆：這句可用更自然的英文表達；目前沒有可錨定的單字卡，建議新增 reservation、fully booked 等單字卡以利之後關聯。
- 候選：
  - sentence：`I need to make a reservation before the restaurant is fully booked.`（我需要在餐廳訂滿之前先訂位。）
    - related collocation：`make a reservation`（訂位）
    - related clause：`before the restaurant is fully booked`（在餐廳被訂滿之前）

### 2. 雖然期限很緊，但我們還是可以完成專案

- 結果：成功
- Session：`cmooblfzw0000j8ua1iv5cm5y`
- 耗時：10.4s
- Intent：`analyze_sentence`
- AI 回覆：這句英文可用讓步子句開頭更自然；目前沒有可錨定的單字卡，建議新增 deadline、tight、project 等以便之後連結。
- 候選：
  - sentence：`Although the deadline is tight, we can still finish the project.`（雖然期限很緊，但我們還是可以完成專案。）
    - related collocation：`tight deadline`（緊迫的期限）
    - related clause：`Although the deadline is tight`（雖然期限很緊）
    - related collocation：`finish the project`（完成專案）

### 3. 因為客戶改了時程，我們開始落後進度

- 結果：成功
- Session：`cmooblfzw0000j8ua1iv5cm5y`
- 耗時：13.6s
- Intent：`analyze_sentence`
- AI 回覆：可用更自然的商務英文表達；目前沒有可錨定的單字卡，建議新增 client、schedule、fall behind 等單字卡方便後續關聯。
- 候選：
  - sentence：`We started falling behind schedule because the client changed the timeline.`（因為客戶改了時程，我們開始落後進度。）
    - related collocation：`fall behind schedule`（進度落後）
    - related clause：`because the client changed the timeline`（因為客戶改了時程）

### 4. 如果會議延後，我會更新行程

- 結果：成功
- Session：`cmooblfzw0000j8ua1iv5cm5y`
- 耗時：12.6s
- Intent：`analyze_sentence`
- AI 回覆：這句用條件子句很自然；目前沒有可錨定的單字卡，建議新增 meeting、postpone、schedule 等以便之後關聯。
- 候選：
  - sentence：`If the meeting is postponed, I'll update my schedule.`（如果會議延後，我會更新行程。）
    - related clause：`If the meeting is postponed`（如果會議延後）
    - related collocation：`update my schedule`（更新我的行程）

### 5. 當你確認房間時，我應該在哪裡等？

- 結果：成功
- Session：`cmooblfzw0000j8ua1iv5cm5y`
- 耗時：9.8s
- Intent：`analyze_sentence`
- AI 回覆：可用更自然的情境英文問法；目前沒有可錨定的單字卡，建議新增 confirm、room、wait 等單字卡方便後續關聯。
- 候選：
  - sentence：`While you're confirming the room, where should I wait?`（當你確認房間時，我應該在哪裡等？）
    - related clause：`While you're confirming the room`（當你在確認房間時）
    - related collocation：`confirm the room`（確認房間）

### 6. 我想把會議往後延一天

- 結果：成功
- Session：`cmooblfzw0000j8ua1iv5cm5y`
- 耗時：10.4s
- Intent：`analyze_sentence`
- AI 回覆：可用更自然的職場說法；目前沒有可錨定的單字卡，建議新增 meeting、push back、one day 等單字卡方便後續關聯。
- 候選：
  - sentence：`I'd like to push the meeting back by one day.`（我想把會議往後延一天。）
    - related collocation：`push the meeting back`（把會議往後延）
    - related phrase：`by one day`（延後一天）

### 7. 我需要提前完成專案

- 結果：成功
- Session：`cmooblfzw0000j8ua1iv5cm5y`
- 耗時：8.9s
- Intent：`analyze_sentence`
- AI 回覆：可用更自然的職場英文說法；目前沒有可錨定的單字卡，建議新增 ahead of schedule、project 等單字卡方便後續關聯。
- 候選：
  - sentence：`I need to finish the project ahead of schedule.`（我需要提前完成專案。）
    - related collocation：`finish the project`（完成專案）
    - related collocation：`ahead of schedule`（提前（在預定時程之前））

### 8. 我想預訂住宿

- 結果：成功
- Session：`cmooblfzw0000j8ua1iv5cm5y`
- 耗時：8.8s
- Intent：`analyze_sentence`
- AI 回覆：這句可用更自然的旅遊英文說法；目前沒有可錨定的單字卡，建議新增 book、accommodation、a stay 等單字卡以便之後關聯。
- 候選：
  - sentence：`I'd like to book accommodation.`（我想預訂住宿。）
    - related collocation：`book accommodation`（預訂住宿）

### 9. 我想安排詳細行程

- 結果：成功
- Session：`cmooblfzw0000j8ua1iv5cm5y`
- 耗時：9.0s
- Intent：`analyze_sentence`
- AI 回覆：這句可用更自然的旅遊/工作英文說法；目前沒有可錨定的單字卡，建議新增 itinerary、plan 等單字卡方便後續關聯。
- 候選：
  - sentence：`I'd like to plan a detailed itinerary.`（我想安排詳細行程。）
    - related collocation：`plan an itinerary`（規劃行程）
    - related phrase：`a detailed itinerary`（一份詳細的行程）

### 10. 我們需要投入額外資源，因為進度落後

- 結果：成功
- Session：`cmooblfzw0000j8ua1iv5cm5y`
- 耗時：12.1s
- Intent：`analyze_sentence`
- AI 回覆：這句用 because 子句很自然；目前沒有可錨定的單字卡，建議新增 allocate、resource、schedule 等單字卡方便後續關聯。
- 候選：
  - sentence：`We need to allocate additional resources because we're behind schedule.`（我們需要投入額外資源，因為進度落後。）
    - related collocation：`allocate additional resources`（投入／調配額外資源）
    - related collocation：`behind schedule`（進度落後）
    - related clause：`because we're behind schedule`（因為我們進度落後）

### 11. 我想比較價格並找到好優惠

- 結果：成功
- Session：`cmooblfzw0000j8ua1iv5cm5y`
- 耗時：8.9s
- Intent：`analyze_sentence`
- AI 回覆：可用更自然的購物英文說法；目前沒有可錨定的單字卡，建議新增 compare、price、deal 等單字卡以便之後關聯。
- 候選：
  - sentence：`I'd like to compare prices and find a good deal.`（我想比較價格並找到好優惠。）
    - related collocation：`compare prices`（比較價格）
    - related collocation：`find a good deal`（找到好優惠）

### 12. 我很累但還是逼自己去健身房

- 結果：成功
- Session：`cmooblfzw0000j8ua1iv5cm5y`
- 耗時：11.3s
- Intent：`analyze_sentence`
- AI 回覆：這句用讓步轉折很自然；目前沒有可錨定的單字卡，建議新增 tired、push myself、go to the gym 等單字卡方便後續關聯。
- 候選：
  - sentence：`I was exhausted, but I still pushed myself to go to the gym.`（我很累但還是逼自己去健身房。）
    - related collocation：`push myself`（逼自己／督促自己）
    - related phrase：`to go to the gym`（去健身房（作為目的））

### 13. 如果飯店客滿，我們要換地方住

- 結果：成功
- Session：`cmooblfzw0000j8ua1iv5cm5y`
- 耗時：12.3s
- Intent：`analyze_sentence`
- AI 回覆：可用條件子句很自然；目前沒有可錨定的單字卡，建議新增 hotel、fully booked、stay 等單字卡方便後續關聯。
- 候選：
  - sentence：`If the hotel is fully booked, we'll stay somewhere else.`（如果飯店客滿，我們要換地方住。）
    - related clause：`If the hotel is fully booked`（如果飯店客滿）
    - related collocation：`be fully booked`（客滿）
    - related collocation：`stay somewhere else`（改住別的地方）

### 14. 當你沉浸在另一種文化時，你會學得更快

- 結果：成功
- Session：`cmooblfzw0000j8ua1iv5cm5y`
- 耗時：10.2s
- Intent：`analyze_sentence`
- AI 回覆：這句用 when 子句很自然；目前沒有可錨定的單字卡，建議新增 immerse、culture、learn 等單字卡方便後續關聯。
- 候選：
  - sentence：`When you immerse yourself in another culture, you learn faster.`（當你沉浸在另一種文化時，你會學得更快。）
    - related collocation：`immerse yourself in another culture`（讓自己沉浸在另一種文化中）
    - related clause：`When you immerse yourself in another culture`（當你沉浸在另一種文化時）

### 15. 雖然行程很滿，我們還是想去那個熱門景點

- 結果：成功
- Session：`cmooblfzw0000j8ua1iv5cm5y`
- 耗時：9.2s
- Intent：`analyze_sentence`
- AI 回覆：可用 although 讓步子句很自然；目前沒有可錨定的單字卡，建議新增 itinerary、packed、popular、attraction 等單字卡方便後續關聯。
- 候選：
  - sentence：`Although our itinerary is packed, we still want to visit that popular attraction.`（雖然行程很滿，我們還是想去那個熱門景點。）
    - related collocation：`packed itinerary`（很滿的行程）
    - related clause：`Although our itinerary is packed`（雖然我們的行程很滿）
    - related collocation：`visit a popular attraction`（去熱門景點）

### 16. 只翻譯：我想延期會議，不要收藏候選

- 結果：成功
- Session：`cmooblfzw0000j8ua1iv5cm5y`
- 耗時：5.2s
- Intent：`translate_only`
- AI 回覆：I’d like to postpone the meeting.
- 候選：無

### 17. 請修正：I very like this plan.

- 結果：成功
- Session：`cmooblfzw0000j8ua1iv5cm5y`
- 耗時：13.5s
- Intent：`correct_sentence`
- AI 回覆：更自然的說法是用副詞修飾 like。
- 候選：
  - sentence：`I really like this plan.`（我很喜歡這個計畫。）
    - related collocation：`really like`（很喜歡）
    - related phrase：`this plan`（這個計畫）

### 18. fall behind schedule 怎麼用？

- 結果：成功
- Session：`cmooblfzw0000j8ua1iv5cm5y`
- 耗時：11.1s
- Intent：`explain_usage`
- AI 回覆：`fall behind schedule` 表示「進度落後（原定時程）」，常用在專案/交付/施工等情境，可接原因子句（because...）。目前沒有可錨定的單字卡，建議新增 fall、behind、schedule 等字卡方便後續關聯。
- 候選：
  - sentence：`We’re falling behind schedule because the vendor delayed the delivery.`（我們進度落後，因為供應商延誤交付。）
    - related collocation：`fall behind schedule`（進度落後）
    - related clause：`because the vendor delayed the delivery`（因為供應商延誤交付）

### 19. 我有沒有收藏 make a reservation？

- 結果：成功
- Session：`cmooblfzw0000j8ua1iv5cm5y`
- 耗時：8.9s
- Intent：`find_existing`
- AI 回覆：目前搜尋結果是空的：你尚未收藏「make a reservation」。要不要我幫你產生一個可收藏的句子版本？
- 候選：無

### 20. heavy rain 怎麼用在句子裡？

- 結果：成功
- Session：`cmooblfzw0000j8ua1iv5cm5y`
- 耗時：13.5s
- Intent：`explain_usage`
- AI 回覆：`heavy rain` 是名詞片語，指「大雨」，常放在 because of、during、after 等後面說明原因或時間。現在沒有可錨定的單字卡，建議新增 heavy、rain 等字卡方便後續關聯。
- 候選：
  - sentence：`The game was postponed because of heavy rain.`（因為大雨，比賽延後了。）
    - related collocation：`heavy rain`（大雨）
    - related phrase：`because of heavy rain`（因為大雨）

### 21. 請幫我把「我想確認預約」變成可以收藏的句子

- 結果：成功
- Session：`cmoobpz3n0015j8ua32b6jbjp`
- 耗時：11.9s
- Intent：`suggest_candidates`
- AI 回覆：已改成自然可用、適合收藏的英文句子；這句的關鍵字（confirm / reservation）目前沒有對應單字卡，建議新增。
- 候選：
  - sentence：`I'd like to confirm my reservation.`（我想確認我的預約。）
    - related collocation：`confirm my reservation`（確認我的預約）
    - related phrase：`my reservation`（我的預約）

### 22. 我明天要開會

- 結果：成功
- Session：`cmoobpz3n0015j8ua32b6jbjp`
- 耗時：10.5s
- Intent：`analyze_sentence`
- AI 回覆：已轉成自然英文句；這句的關鍵字（meeting / tomorrow / have）目前沒有可錨定的單字卡，建議新增。
- 候選：
  - sentence：`I have a meeting tomorrow.`（我明天要開會。）
    - related collocation：`have a meeting`（開會／有一場會議）
    - related phrase：`tomorrow`（明天）

### 23. We fell behind schedule because the vendor delayed delivery.

- 結果：成功
- Session：`cmoobpz3n0015j8ua32b6jbjp`
- 耗時：9.1s
- Intent：`analyze_sentence`
- AI 回覆：這句很適合收藏；主要重點在描述「進度落後」以及用 because 說明原因。
- 候選：
  - sentence：`We fell behind schedule because the vendor delayed delivery.`（我們進度落後，因為供應商延誤交付。）
    - related collocation：`fell behind schedule`（（進度）落後）
    - related clause：`because the vendor delayed delivery`（因為供應商延誤交付）
    - related collocation：`delayed delivery`（延誤交付）

### 24. Can you make this natural: We delayed the meeting to tomorrow.

- 結果：成功
- Session：`cmoobpz3n0015j8ua32b6jbjp`
- 耗時：7.7s
- Intent：`correct_sentence`
- AI 回覆：已改成更自然的說法；建議新增單字/片語：push back、reschedule、tomorrow、meeting。
- 候選：
  - sentence：`We pushed the meeting back to tomorrow.`（我們把會議延到明天。）
    - related collocation：`pushed the meeting back`（把會議往後延／延後會議）
    - related phrase：`to tomorrow`（到明天）

### 25. 我想說「我們會準時完成」

- 結果：成功
- Session：`cmoobpz3n0015j8ua32b6jbjp`
- 耗時：7.8s
- Intent：`suggest_candidates`
- AI 回覆：我把它變成自然、職場常用的收藏句；這句的關鍵字（on time / finish / project）目前沒有可錨定單字卡，建議新增。
- 候選：
  - sentence：`We'll finish on time.`（我們會準時完成。）
    - related collocation：`finish on time`（準時完成）
    - related phrase：`on time`（準時）

### 26. 我想說「我需要請朋友幫忙」

- 結果：成功
- Session：`cmoobpz3n0015j8ua32b6jbjp`
- 耗時：10.7s
- Intent：`suggest_candidates`
- AI 回覆：我改成自然口語、可直接套用的收藏句；建議新增單字：need、friend、help。
- 候選：
  - sentence：`I need to ask a friend for help.`（我需要請朋友幫忙。）
    - related collocation：`ask a friend for help`（請朋友幫忙）
    - related collocation：`need to ask`（需要去請（人））
    - related phrase：`for help`（為了幫忙／請幫忙）

### 27. 我想說「先付咖啡錢」

- 結果：成功
- Session：`cmoobpz3n0015j8ua32b6jbjp`
- 耗時：7.8s
- Intent：`suggest_candidates`
- AI 回覆：我把它改成更自然、口語常用的收藏句；建議新增單字：pay、coffee。
- 候選：
  - sentence：`Let me pay for the coffee first.`（我先付咖啡錢。）
    - related collocation：`pay for the coffee`（付咖啡錢／付這杯咖啡）
    - related phrase：`first`（先）

### 28. 如果鬧鐘一直響，我會請櫃台處理

- 結果：成功
- Session：`cmoobpz3n0015j8ua32b6jbjp`
- 耗時：14.8s
- Intent：`analyze_sentence`
- AI 回覆：我把它整理成自然、可直接套用的條件句；關鍵字（alarm / go off / front desk / take care of）目前沒有可錨定單字卡，建議新增。
- 候選：
  - sentence：`If the alarm keeps going off, I'll ask the front desk to take care of it.`（如果鬧鐘一直響，我會請櫃台處理。）
    - related clause：`If the alarm keeps going off`（如果鬧鐘一直響）
    - related collocation：`keeps going off`（一直響／不停作響）
    - related collocation：`ask the front desk`（請櫃台（協助／處理））
    - related collocation：`take care of it`（處理它／搞定它）
    - related phrase：`the front desk`（櫃台）

### 29. 雖然房間有問題，我們還是先等你檢查

- 結果：成功
- Session：`cmoobpz3n0015j8ua32b6jbjp`
- 耗時：16.7s
- Intent：`analyze_sentence`
- AI 回覆：我把它改成自然的讓步句（Although…）；關鍵字（issue/room/wait/check）目前無可錨定單字卡，建議新增。
- 候選：
  - sentence：`Although there's an issue with the room, we'll wait for you to check it first.`（雖然房間有問題，我們還是先等你檢查。）
    - related clause：`Although there's an issue with the room`（雖然房間有問題）
    - related phrase：`an issue with the room`（房間的問題）
    - related phrase：`wait for you to check it first`（先等你檢查）
    - related collocation：`check it`（檢查它）

### 30. 我想把「門打不開」講得自然一點

- 結果：成功
- Session：`cmoobpz3n0015j8ua32b6jbjp`
- 耗時：10.1s
- Intent：`suggest_candidates`
- AI 回覆：我給你一個最常用、最自然的說法；建議新增單字：door、open、won't。
- 候選：
  - sentence：`The door won't open.`（門打不開。）
    - related collocation：`won't open`（打不開／無法打開）
    - related phrase：`The door`（那扇門／門）

### 31. 搜尋收藏：postpone the meeting

- 結果：成功
- Session：`cmoobpz3n0015j8ua32b6jbjp`
- 耗時：6.4s
- Intent：`find_existing`
- AI 回覆：目前搜尋不到既有收藏包含「postpone the meeting」。你可以改收藏較常用的說法（如「push the meeting back」），或新增 postpone / meeting 相關單字卡後再建立搭配詞。
- 候選：無

### 32. 如果供應商延遲交付，我們會重新安排時程

- 結果：成功
- Session：`cmoobpz3n0015j8ua32b6jbjp`
- 耗時：13.9s
- Intent：`analyze_sentence`
- AI 回覆：我把它改成職場常用的條件句（If…）；關鍵字（vendor / delay / delivery / revise / timeline）目前無可錨定單字卡，建議新增。
- 候選：
  - sentence：`If the vendor delays the delivery, we'll revise the timeline.`（如果供應商延遲交付，我們會重新安排時程。）
    - related clause：`If the vendor delays the delivery`（如果供應商延遲交付）
    - related collocation：`delays the delivery`（延遲交付）
    - related collocation：`revise the timeline`（調整／重新安排時程）
    - related phrase：`the timeline`（時程）

### 33. 我想說「我的行程很滿」

- 結果：成功
- Session：`cmoobpz3n0015j8ua32b6jbjp`
- 耗時：7.4s
- Intent：`suggest_candidates`
- AI 回覆：我把它改成最自然、最常用的說法；建議新增單字：schedule、packed。
- 候選：
  - sentence：`My schedule is packed.`（我的行程很滿。）
    - related collocation：`schedule is packed`（行程很滿／排很滿）
    - related phrase：`My schedule`（我的行程）

### 34. 請幫我拆解：I need to check out before noon.

- 結果：成功
- Session：`cmoobpz3n0015j8ua32b6jbjp`
- 耗時：11.4s
- Intent：`analyze_sentence`
- AI 回覆：已拆成最常用的關鍵積木（退房 + 時間）。
- 候選：
  - sentence：`I need to check out before noon.`（我需要在中午前退房。）
    - related collocation：`check out`（退房）
    - related phrase：`before noon`（中午前）

### 35. 如果房間還沒準備好，我可以先寄放行李嗎？

- 結果：成功
- Session：`cmoobpz3n0015j8ua32b6jbjp`
- 耗時：9.8s
- Intent：`analyze_sentence`
- AI 回覆：我用旅館情境最常用的 If… 句型整理成可直接開口的一句，並拆出關鍵積木；建議新增單字：room、ready、store、luggage。
- 候選：
  - sentence：`If the room isn't ready yet, can I store my luggage first?`（如果房間還沒準備好，我可以先寄放行李嗎？）
    - related clause：`If the room isn't ready yet`（如果房間還沒準備好）
    - related collocation：`store my luggage`（寄放行李）
    - related phrase：`first`（先）
    - related phrase：`ready yet`（還沒準備好）

### 36. 雖然天氣不好，我們還是照原計畫出發

- 結果：成功
- Session：`cmoobpz3n0015j8ua32b6jbjp`
- 耗時：9.1s
- Intent：`analyze_sentence`
- AI 回覆：已整理成自然的讓步句（Although…），並拆出可重複使用的積木；關鍵字（weather / bad / stick to / plan / leave）目前無可錨定單字卡，建議新增。
- 候選：
  - sentence：`Although the weather is bad, we'll stick to the plan and leave as scheduled.`（雖然天氣不好，我們還是照原計畫出發。）
    - related clause：`Although the weather is bad`（雖然天氣不好）
    - related collocation：`stick to the plan`（照原計畫／按原定計畫進行）
    - related collocation：`leave as scheduled`（照預定時間出發）

### 37. 我想說「請幫我取消預約」

- 結果：成功
- Session：`cmoobpz3n0015j8ua32b6jbjp`
- 耗時：8.1s
- Intent：`suggest_candidates`
- AI 回覆：我改成自然、禮貌、可直接套用的收藏句；建議新增單字：cancel、reservation。
- 候選：
  - sentence：`Could you help me cancel my reservation?`（請幫我取消預約。）
    - related collocation：`cancel my reservation`（取消我的預約）
    - related collocation：`help me cancel`（幫我取消）

### 38. 只翻譯：我想先確認付款狀態，不要收藏

- 結果：成功
- Session：`cmoobpz3n0015j8ua32b6jbjp`
- 耗時：5.6s
- Intent：`translate_only`
- AI 回覆：I’d like to confirm the payment status first.
- 候選：無

### 39. Can you fix this: I am agree with you.

- 結果：成功
- Session：`cmoobpz3n0015j8ua32b6jbjp`
- 耗時：9.9s
- Intent：`correct_sentence`
- AI 回覆：「agree」不能用 _am_；下面是自然正確的版本（建議新增單字：agree）。
- 候選：
  - sentence：`I agree with you.`（我同意你。）
    - related collocation：`agree with you`（同意你／贊同你）

### 40. 我想知道 book accommodation 跟 reserve a room 差在哪

- 結果：成功
- Session：`cmoobpz3n0015j8ua32b6jbjp`
- 耗時：13.7s
- Intent：`explain_usage`
- AI 回覆：兩者意思很接近，但使用情境與語氣不同：`book accommodation` 較「泛、正式」，指訂住宿（可能是飯店/民宿/公寓/整段住宿）；`reserve a room` 較「具體、偏飯店」，強調先保留一間房（不一定完成付款）。一般旅遊/訂房平台常用 `book accommodation`；和飯店溝通、或只想先保留房型時常用 `reserve a room`。你目前沒有可錨定的單字卡（book/reserve/room/accommodation），若要收藏搭配詞建議先新增這些字卡。
- 候選：
  - sentence：`I booked accommodation for three nights.`（我訂了三晚的住宿。）
    - related collocation：`booked accommodation`（訂住宿）
    - related phrase：`for three nights`（住三晚）
  - sentence：`I'd like to reserve a room for next Friday.`（我想預訂下週五的房間。）
    - related collocation：`reserve a room`（預訂一間房／先保留房間）
    - related phrase：`for next Friday`（下週五（那天））

### 41. 我想說「請把報告寄給我」

- 結果：成功
- Session：`cmoobubco002aj8uaoj67ldlq`
- 耗時：8.1s
- Intent：`suggest_candidates`
- AI 回覆：我先給你一個最自然的說法；目前沒有可錨定的既有單字卡，建議新增 send / report / email 等單字卡，之後更好關聯收藏。
- 候選：
  - sentence：`Please send me the report.`（請把報告寄給我。）
    - related collocation：`send me the report`（把報告寄給我）
    - related phrase：`Please`（請（禮貌用語））

### 42. 如果我們趕不上期限，需要請主管協助

- 結果：成功
- Session：`cmoobubco002aj8uaoj67ldlq`
- 耗時：13.8s
- Intent：`analyze_sentence`
- AI 回覆：這句很適合用條件句表達；目前沒有可錨定的既有單字卡，建議新增 meet、deadline、manager、ask、help。
- 候選：
  - sentence：`If we can't meet the deadline, we'll need to ask our manager for help.`（如果我們趕不上期限，我們需要請主管協助。）
    - related clause：`If we can't meet the deadline`（如果我們趕不上期限）
    - related collocation：`meet the deadline`（趕上期限／如期完成）
    - related collocation：`ask our manager for help`（請主管協助）

### 43. 雖然預算有限，我們還是要維持品質

- 結果：成功
- Session：`cmoobubco002aj8uaoj67ldlq`
- 耗時：8.4s
- Intent：`analyze_sentence`
- AI 回覆：用讓步子句（Although...）最貼切；目前沒有可錨定的既有單字卡，建議新增 budget、limited、maintain、quality。
- 候選：
  - sentence：`Although our budget is limited, we still need to maintain quality.`（雖然預算有限，我們還是要維持品質。）
    - related clause：`Although our budget is limited`（雖然我們的預算有限）
    - related collocation：`maintain quality`（維持品質）

### 44. 我想把「我需要請假一天」講自然一點

- 結果：成功
- Session：`cmoobubco002aj8uaoj67ldlq`
- 耗時：8.1s
- Intent：`analyze_sentence`
- AI 回覆：我給你一個職場最常用、很自然的說法；目前沒有可錨定的既有單字卡，建議新增 take、day off、leave。
- 候選：
  - sentence：`I need to take a day off.`（我需要請假一天。）
    - related collocation：`take a day off`（請假一天／休假一天）
    - related phrase：`a day off`（一天的休假）

### 45. 請幫我產生跟 schedule 有關的語塊

- 結果：成功
- Session：`cmoobubco002aj8uaoj67ldlq`
- 耗時：27.2s
- Intent：`suggest_candidates`
- AI 回覆：我整理了幾個職場最常用、都含 schedule 的句子可直接收藏；目前沒有可錨定的既有單字卡，建議新增 schedule、behind、reschedule、stick to。
- 候選：
  - sentence：`We're running behind schedule because the vendor delayed the delivery.`（我們進度落後，因為供應商延誤交付。）
    - related collocation：`run behind schedule`（進度落後）
    - related clause：`because the vendor delayed the delivery`（因為供應商延誤交付）
  - sentence：`Can we reschedule the meeting for next week?`（我們可以把會議改到下週嗎？）
    - related collocation：`reschedule the meeting`（改期會議）
    - related phrase：`for next week`（改到下週）
  - sentence：`Let's stick to the schedule so we can finish on time.`（我們照著時程走，這樣才能準時完成。）
    - related collocation：`stick to the schedule`（遵守／照著時程走）
    - related clause：`so we can finish on time`（所以我們才能準時完成）
    - related phrase：`on time`（準時）
  - sentence：`Please check the schedule and let me know if anything changes.`（請確認一下時程，如果有任何變動請告訴我。）
    - related collocation：`check the schedule`（確認時程／行程表）
    - related clause：`if anything changes`（如果有任何變動）

### 46. 我有沒有收藏 fall behind schedule？

- 結果：成功
- Session：`cmoobubco002aj8uaoj67ldlq`
- 耗時：17.1s
- Intent：`find_existing`
- AI 回覆：目前既有收藏搜尋結果是空的，代表你現在看不到已收藏的「fall behind schedule」（可能尚未收藏，或後端這次沒有回傳到）。要不要我幫你產生可收藏版本，之後就能搜尋得到？
- 候選：無

### 47. 我想說「這份文件有問題」

- 結果：成功
- Session：`cmoobubco002aj8uaoj67ldlq`
- 耗時：8.6s
- Intent：`suggest_candidates`
- AI 回覆：我給你一個最自然、職場常用的說法；目前沒有可錨定的既有單字卡，建議新增 document、issue、problem。
- 候選：
  - sentence：`There’s an issue with this document.`（這份文件有問題。）
    - related collocation：`an issue with this document`（這份文件有個問題／有狀況）
    - related phrase：`with this document`（在這份文件上／就這份文件而言）

### 48. When the alarm goes off, I need to leave immediately.

- 結果：成功
- Session：`cmoobubco002aj8uaoj67ldlq`
- 耗時：9.7s
- Intent：`analyze_sentence`
- AI 回覆：這句很好用在提醒自己「一響就得立刻走」；目前沒有可錨定的既有單字卡，建議新增 alarm、go off、leave、immediately。
- 候選：
  - sentence：`When the alarm goes off, I need to leave immediately.`（當鬧鐘響起時，我需要立刻離開。）
    - related clause：`When the alarm goes off`（當鬧鐘響起時）
    - related collocation：`the alarm goes off`（鬧鐘響起）
    - related collocation：`leave immediately`（立刻離開）

### 49. 我想說「我會晚一點到」

- 結果：成功
- Session：`cmoobubco002aj8uaoj67ldlq`
- 耗時：8.7s
- Intent：`suggest_candidates`
- AI 回覆：給你一個最自然、日常/職場都能用的說法；目前沒有可錨定的既有單字卡，建議新增 late、arrive、a bit。
- 候選：
  - sentence：`I'm going to be a bit late.`（我會晚一點到。）
    - related phrase：`a bit late`（晚一點（稍微遲到））
    - related collocation：`be a bit late`（會晚一點／會稍微遲到）

### 50. 請解釋 ahead of schedule 怎麼用

- 結果：成功
- Session：`cmoobubco002aj8uaoj67ldlq`
- 耗時：11.1s
- Intent：`explain_usage`
- AI 回覆：`ahead of schedule` 表示「比預定進度更快／提前完成」，常接在 be 動詞或完成動詞後：We’re ahead of schedule. / We finished ahead of schedule. 也常用 `stay`/`get` ahead of schedule（保持／變得超前進度）。目前沒有可錨定的既有單字卡，建議新增 schedule、ahead。
- 候選：
  - sentence：`We’re ahead of schedule, so we can wrap up early.`（我們進度超前，所以可以提早收尾。）
    - related collocation：`ahead of schedule`（超前進度／提前完成）
    - related clause：`so we can wrap up early`（所以我們可以提早收尾）
    - related phrase：`early`（提早）

### 51. 如果價格下降，我們要調整銷售策略

- 結果：成功
- Session：`cmoobubco002aj8uaoj67ldlq`
- 耗時：8.5s
- Intent：`analyze_sentence`
- AI 回覆：用條件句（If...）最自然；目前沒有可錨定的既有單字卡，建議新增 price、drop、adjust、sales、strategy。
- 候選：
  - sentence：`If the price drops, we’ll need to adjust our sales strategy.`（如果價格下降，我們要調整銷售策略。）
    - related clause：`If the price drops`（如果價格下降）
    - related collocation：`adjust our sales strategy`（調整我們的銷售策略）

### 52. 雖然簡報被延後，會議還是開得比預期久

- 結果：成功
- Session：`cmoobubco002aj8uaoj67ldlq`
- 耗時：14.8s
- Intent：`analyze_sentence`
- AI 回覆：這句用讓步子句（Although...）很自然；目前沒有可錨定的既有單字卡，建議新增 presentation、delay、meeting、expected。
- 候選：
  - sentence：`Although the presentation was delayed, the meeting still ran longer than expected.`（雖然簡報被延後，會議還是開得比預期久。）
    - related clause：`Although the presentation was delayed`（雖然簡報被延後）
    - related collocation：`ran longer than expected`（開得比預期久／拖得比預期久）
    - related phrase：`longer than expected`（比預期久）

### 53. 我想說「我們需要更多時間」

- 結果：成功
- Session：`cmoobubco002aj8uaoj67ldlq`
- 耗時：10.6s
- Intent：`suggest_candidates`
- AI 回覆：給你一個最自然、職場很常用的說法；目前沒有可錨定的既有單字卡，建議新增 need、more、time。
- 候選：
  - sentence：`We need more time.`（我們需要更多時間。）
    - related collocation：`need more time`（需要更多時間）
    - related phrase：`more time`（更多時間）

### 54. Can you make this natural: Please send me document.

- 結果：成功
- Session：`cmoobubco002aj8uaoj67ldlq`
- 耗時：8.4s
- Intent：`correct_sentence`
- AI 回覆：更自然的說法會加上冠詞/代名詞，也常補一句禮貌結尾；目前沒有可錨定的既有單字卡，建議新增 send、document。
- 候選：
  - sentence：`Please send me the document.`（請把那份文件寄給我。）
    - related collocation：`send me the document`（把文件寄給我）
    - related phrase：`Please`（請（禮貌用語））

### 55. 我想說「我需要換到比較好的房間」

- 結果：成功
- Session：`cmoobubco002aj8uaoj67ldlq`
- 耗時：8.0s
- Intent：`suggest_candidates`
- AI 回覆：我給你一個飯店情境很自然的說法；目前沒有可錨定的既有單字卡，建議新增 upgrade、room、better。
- 候選：
  - sentence：`I need to switch to a better room.`（我需要換到比較好的房間。）
    - related collocation：`switch to a better room`（換到比較好的房間）
    - related phrase：`a better room`（比較好的房間）

### 56. 如果門打不開，我會請櫃台處理

- 結果：成功
- Session：`cmoobubco002aj8uaoj67ldlq`
- 耗時：16.7s
- Intent：`analyze_sentence`
- AI 回覆：這句用條件句（If...）很自然；目前沒有可錨定的既有單字卡，建議新增 door、open、front desk、handle。
- 候選：
  - sentence：`If the door won't open, I'll ask the front desk to take care of it.`（如果門打不開，我會請櫃台處理。）
    - related clause：`If the door won't open`（如果門打不開）
    - related collocation：`ask the front desk to take care of it`（請櫃台處理這件事）
    - related collocation：`take care of it`（處理好／搞定）

### 57. 請幫我把「我找不到我的房卡」變成英文句子

- 結果：成功
- Session：`cmoobubco002aj8uaoj67ldlq`
- 耗時：9.5s
- Intent：`analyze_sentence`
- AI 回覆：最自然的說法是用 find；目前沒有可錨定的既有單字卡，建議新增 find、room key、key card。
- 候選：
  - sentence：`I can't find my room key.`（我找不到我的房卡。）
    - related collocation：`find my room key`（找到我的房卡）
    - related phrase：`my room key`（我的房卡）

### 58. 我想說「這場雨很大」

- 結果：成功
- Session：`cmoobubco002aj8uaoj67ldlq`
- 耗時：8.8s
- Intent：`suggest_candidates`
- AI 回覆：最常用的是 heavy rain；目前沒有可錨定的既有單字卡，建議新增 rain、heavy。
- 候選：
  - sentence：`It's raining heavily.`（雨下得很大。）
    - related collocation：`rain heavily`（雨下得很大）
  - sentence：`It's heavy rain.`（這場雨很大。）
    - related collocation：`heavy rain`（大雨）

### 59. 只翻譯：我需要買菜

- 結果：成功
- Session：`cmoobubco002aj8uaoj67ldlq`
- 耗時：8.5s
- Intent：`translate_only`
- AI 回覆：I need to buy groceries.
- 候選：無

### 60. 我想說「我今天不想去健身房」

- 結果：成功
- Session：`cmoobubco002aj8uaoj67ldlq`
- 耗時：8.8s
- Intent：`suggest_candidates`
- AI 回覆：給你一個很自然、口語常用的說法；目前沒有可錨定的既有單字卡，建議新增 gym、feel like。
- 候選：
  - sentence：`I don't feel like going to the gym today.`（我今天不想去健身房。）
    - related collocation：`feel like going to the gym`（想去健身房（有那個心情））
    - related phrase：`to the gym`（去健身房）
    - related phrase：`today`（今天）

### 61. 如果專案進度落後，我們要加派人手

- 結果：成功
- Session：`cmoobz3rr003fj8ua4ykp8ls7`
- 耗時：17.7s
- Intent：`analyze_sentence`
- AI 回覆：可翻成條件句：如果專案進度落後，我們就需要加派人手。建議可新增單字/片語卡：schedule、staff、allocate、fall behind。
- 候選：
  - sentence：`If the project falls behind schedule, we need to allocate more staff.`（如果專案進度落後，我們就需要加派人手。）
    - related clause：`If the project falls behind schedule`（如果專案進度落後）
    - related collocation：`fall behind schedule`（進度落後）
    - related collocation：`allocate more staff`（加派／增派人手）

### 62. 雖然飯店很貴，我們還是訂了兩晚

- 結果：成功
- Session：`cmoobz3rr003fj8ua4ykp8ls7`
- 耗時：10.8s
- Intent：`analyze_sentence`
- AI 回覆：這句很適合用讓步句：Although... / Even though...。建議可新增單字/片語卡：book（預訂）、expensive、hotel、two nights。
- 候選：
  - sentence：`Although the hotel was expensive, we still booked two nights.`（雖然飯店很貴，我們還是訂了兩晚。）
    - related clause：`Although the hotel was expensive`（雖然飯店很貴）
    - related collocation：`book two nights`（預訂兩晚）
    - related phrase：`two nights`（兩晚）

### 63. 我想說「請先比較價格」

- 結果：成功
- Session：`cmoobz3rr003fj8ua4ykp8ls7`
- 耗時：13.0s
- Intent：`suggest_candidates`
- AI 回覆：你可以用這句更自然的英文來表達「請先比較價格」；其中「first」也很適合單獨收藏成時間順序用法。
- 候選：
  - sentence：`Please compare prices first.`（請先比較價格。）
    - related collocation：`compare prices`（比較價格）
    - related phrase：`first`（先／首先）

### 64. Can you correct this: The meeting was longer than I expect.

- 結果：成功
- Session：`cmoobz3rr003fj8ua4ykp8ls7`
- 耗時：9.5s
- Intent：`correct_sentence`
- AI 回覆：已修正為過去式一致（expect → expected）。
- 候選：
  - sentence：`The meeting was longer than I expected.`（會議比我預期的更久。）
    - related phrase：`longer than I expected`（比我預期的更久）
    - related phrase：`The meeting`（這場會議）

### 65. 我想知道 secure a table 怎麼用

- 結果：成功
- Session：`cmoobz3rr003fj8ua4ykp8ls7`
- 耗時：14.4s
- Intent：`explain_usage`
- AI 回覆：「secure a table」=（先）訂到／確保有位子（多指餐廳訂位，語氣比 book/reserve 更強調「好不容易拿到」）。也常接時間與人數。建議可新增：secure（動詞）、reservation、availability。
- 候選：
  - sentence：`I secured a table for two at 7 p.m.`（我訂到一張晚上七點、兩人座的位子。）
    - related collocation：`secure a table`（訂到／確保有位子）
    - related phrase：`for two`（兩位）
    - related phrase：`at 7 p.m.`（在晚上七點）

### 66. 請幫我產生跟 deadline 有關的句子和語塊

- 結果：成功
- Session：`cmoobz3rr003fj8ua4ykp8ls7`
- 耗時：22.3s
- Intent：`suggest_candidates`
- AI 回覆：我先給你幾句最常用、可直接收藏的 deadline 句型；目前沒有可錨定的既有單字卡，建議新增：deadline、meet、miss、extend、approaching、tight。
- 候選：
  - sentence：`We need to meet the deadline.`（我們需要如期趕上截止期限。）
    - related collocation：`meet the deadline`（如期趕上截止期限）
  - sentence：`We might miss the deadline if we don’t get help.`（如果我們得不到支援，可能會趕不上期限。）
    - related collocation：`miss the deadline`（趕不上期限）
    - related clause：`if we don’t get help`（如果我們得不到支援）
  - sentence：`Although the deadline is tight, we can still deliver on time.`（雖然期限很緊，我們還是可以準時交付。）
    - related collocation：`tight deadline`（緊迫的期限）
    - related clause：`Although the deadline is tight`（雖然期限很緊）
    - related collocation：`deliver on time`（準時交付）
  - sentence：`The deadline is approaching, so we need to prioritize this task.`（截止期限快到了，所以我們需要把這個任務擺第一優先。）
    - related collocation：`the deadline is approaching`（截止期限快到了）
    - related clause：`so we need to prioritize this task`（所以我們需要把這個任務擺第一優先）
    - related collocation：`prioritize this task`（把這個任務列為優先）

### 67. 我想說「我們需要在短時間內做決定」

- 結果：成功
- Session：`cmoobz3rr003fj8ua4ykp8ls7`
- 耗時：13.5s
- Intent：`suggest_candidates`
- AI 回覆：下面是幾種自然說法（正式/口語都有）；目前沒有可錨定的既有單字卡，建議新增：decision、make a decision、short notice、tight timeline。
- 候選：
  - sentence：`We need to make a decision in a short amount of time.`（我們需要在短時間內做決定。）
    - related collocation：`make a decision`（做決定）
    - related phrase：`in a short amount of time`（在短時間內）
  - sentence：`We need to decide quickly.`（我們需要盡快做決定。）
    - related collocation：`decide quickly`（快速做決定）

### 68. 如果客戶不同意，我們要提出替代方案

- 結果：成功
- Session：`cmoobz3rr003fj8ua4ykp8ls7`
- 耗時：18.0s
- Intent：`analyze_sentence`
- AI 回覆：可用條件句表達「如果…就…」。目前只可錨定到既有單字卡 `can`；建議新增：client、agree、alternative、proposal。
- 候選：
  - sentence：`If the client doesn’t agree, we can propose an alternative plan.`（如果客戶不同意，我們可以提出替代方案。）
    - related clause：`If the client doesn’t agree`（如果客戶不同意）
    - related phrase：`can propose an alternative plan`（可以提出替代方案）
    - related collocation：`propose an alternative plan`（提出替代方案）

### 69. 雖然我很累，我還是完成了訓練

- 結果：成功
- Session：`cmoobz3rr003fj8ua4ykp8ls7`
- 耗時：12.6s
- Intent：`analyze_sentence`
- AI 回覆：可用讓步句來表達「雖然…還是…」。目前沒有可錨定的既有單字卡，建議新增：tired、complete、training、although。
- 候選：
  - sentence：`Although I was tired, I still completed the training.`（雖然我很累，我還是完成了訓練。）
    - related clause：`Although I was tired`（雖然我很累）
    - related collocation：`complete the training`（完成訓練）

### 70. 我想把「我需要建立耐力」講自然一點

- 結果：成功
- Session：`cmoobz3rr003fj8ua4ykp8ls7`
- 耗時：13.6s
- Intent：`suggest_candidates`
- AI 回覆：更自然常見的說法是用 build up / improve 來搭配 endurance（或 stamina）。目前沒有可錨定的既有單字卡，建議新增：endurance、stamina、build up、improve。
- 候選：
  - sentence：`I need to build up my endurance.`（我需要建立（培養）耐力。）
    - related collocation：`build up my endurance`（培養／建立我的耐力）
    - related collocation：`build up endurance`（培養／建立耐力）
  - sentence：`I need to improve my stamina.`（我需要提升我的體力／耐力。）
    - related collocation：`improve my stamina`（提升我的體力／耐力）

### 71. 搜尋收藏：ahead of schedule

- 結果：成功
- Session：`cmoobz3rr003fj8ua4ykp8ls7`
- 耗時：7.1s
- Intent：`find_existing`
- AI 回覆：目前既有收藏搜尋結果是空的，代表你尚未收藏「ahead of schedule」。要不要我幫你產生幾個可收藏的句子/語塊版本？
- 候選：無

### 72. 我想說「我們應該按計畫進行」

- 結果：成功
- Session：`cmoobz3rr003fj8ua4ykp8ls7`
- 耗時：9.3s
- Intent：`suggest_candidates`
- AI 回覆：這句最自然的職場說法常用 on schedule / as planned。目前沒有可錨定的既有單字卡，建議新增：plan、schedule、stay on track。
- 候選：
  - sentence：`We should stay on schedule.`（我們應該按計畫進行／照進度走。）
    - related collocation：`stay on schedule`（按計畫進行／照進度走）
  - sentence：`We should proceed as planned.`（我們應該按計畫進行。）
    - related collocation：`proceed as planned`（按計畫進行）

### 73. Please explain the difference between delay and postpone.

- 結果：成功
- Session：`cmoobz3rr003fj8ua4ykp8ls7`
- 耗時：17.1s
- Intent：`explain_usage`
- AI 回覆：`delay` 多指「讓事情晚一點發生／變慢」（常見被動：be delayed），也可指「耽誤某事」；`postpone` 多指「把已排定的事改期到更晚的時間」。建議可新增：delay、postpone、reschedule。
- 候選：
  - sentence：`We decided to postpone the meeting until next week.`（我們決定把會議延到下週。）
    - related collocation：`postpone the meeting`（把會議延期／改期）
    - related phrase：`until next week`（直到下週／延到下週）
  - sentence：`The flight was delayed by two hours because of the storm.`（因為暴風雨，航班延誤了兩小時。）
    - related phrase：`was delayed by two hours`（延誤兩小時）
    - related phrase：`because of the storm`（因為暴風雨）

### 74. 如果我錯過火車，我會改搭計程車

- 結果：成功
- Session：`cmoobz3rr003fj8ua4ykp8ls7`
- 耗時：16.6s
- Intent：`analyze_sentence`
- AI 回覆：可用條件句表達「如果…就…」。目前只可錨定到既有單字卡 `can`；建議新增：miss、train、taxi、instead。
- 候選：
  - sentence：`If I miss the train, I can take a taxi instead.`（如果我錯過火車，我會改搭計程車。）
    - related clause：`If I miss the train`（如果我錯過火車）
    - related phrase：`can take a taxi instead`（可以改搭計程車）
    - related collocation：`miss the train`（錯過火車）
    - related collocation：`take a taxi`（搭計程車）

### 75. 雖然房間很小，但位置很方便

- 結果：成功
- Session：`cmoobz3rr003fj8ua4ykp8ls7`
- 耗時：20.4s
- Intent：`analyze_sentence`
- AI 回覆：可用讓步句型：Although A, B。這句目前沒有可錨定的既有單字卡，建議新增：room、small、location、convenient、although。
- 候選：
  - sentence：`Although the room is small, the location is very convenient.`（雖然房間很小，但位置很方便。）
    - related clause：`Although the room is small`（雖然房間很小）
    - related collocation：`convenient location`（方便的位置）
    - related phrase：`very convenient`（很方便）

### 76. 我想說「我會把行程寄給你」

- 結果：成功
- Session：`cmoobz3rr003fj8ua4ykp8ls7`
- 耗時：8.9s
- Intent：`suggest_candidates`
- AI 回覆：最自然常見是用 send / email + itinerary。你目前沒有可錨定的既有單字卡，建議新增：send、email、itinerary、schedule。
- 候選：
  - sentence：`I'll send you the itinerary.`（我會把行程寄給你。）
    - related collocation：`send you the itinerary`（把行程寄給你）
  - sentence：`I'll email you the schedule.`（我會把行程表寄給你。）
    - related collocation：`email you the schedule`（把行程表寄給你）

### 77. Can you make this natural: I want to discuss about the project.

- 結果：成功
- Session：`cmoobz3rr003fj8ua4ykp8ls7`
- 耗時：9.8s
- Intent：`correct_sentence`
- AI 回覆：`discuss` 後面直接接受詞，不用 `about`；也常用更自然的 `talk about`。
- 候選：
  - sentence：`I want to discuss the project.`（我想討論這個專案。）
    - related collocation：`discuss the project`（討論這個專案）

### 78. 我想說「請提醒我明天開會」

- 結果：成功
- Session：`cmoobz3rr003fj8ua4ykp8ls7`
- 耗時：19.8s
- Intent：`suggest_candidates`
- AI 回覆：常見自然說法是用「remind + 人 + about + 事情」或「remind + 人 + to + 動作」。目前只能用既有單字卡錨定到 `can/you`，建議新增：remind、meeting、tomorrow。
- 候選：
  - sentence：`Can you remind me about tomorrow’s meeting?`（你可以提醒我明天要開會嗎？）
    - related collocation：`remind me`（提醒我）
    - related phrase：`about tomorrow’s meeting`（關於明天的會議／明天要開會這件事）
    - related phrase：`Can you`（你可以…嗎？）

### 79. 如果預約被取消，我們要重新訂位

- 結果：成功
- Session：`cmoobz3rr003fj8ua4ykp8ls7`
- 耗時：18.2s
- Intent：`analyze_sentence`
- AI 回覆：可用條件句表達「如果…就…」。目前沒有可錨定的既有單字卡，建議新增：reservation、cancel、rebook。
- 候選：
  - sentence：`If the reservation is canceled, we need to make a new reservation.`（如果預約被取消，我們就要重新訂位。）
    - related clause：`If the reservation is canceled`（如果預約被取消）
    - related collocation：`make a new reservation`（重新訂位／再訂一次）

### 80. 雖然價格很高，這仍然是熱門景點

- 結果：成功
- Session：`cmoobz3rr003fj8ua4ykp8ls7`
- 耗時：9.8s
- Intent：`analyze_sentence`
- AI 回覆：可用讓步句型：Although A, B。這句目前沒有可錨定的既有單字卡，建議新增：price、high、popular、attraction。
- 候選：
  - sentence：`Although the price is high, it’s still a popular attraction.`（雖然價格很高，這仍然是熱門景點。）
    - related clause：`Although the price is high`（雖然價格很高）
    - related collocation：`popular attraction`（熱門景點）
    - related phrase：`still a popular attraction`（仍然是熱門景點）

### 81. 請幫我拆解：We worked around the clock to finish the project.

- 結果：成功
- Session：`cmooc55m2004kj8uabhqs4ejk`
- 耗時：12.4s
- Intent：`analyze_sentence`
- AI 回覆：已拆解並挑出可直接收藏的重點用法；目前沒有可錨定的既有單字卡，建議新增 around、clock、finish、project、work 等單字卡以便連結。
- 候選：
  - sentence：`We worked around the clock to finish the project.`（我們日以繼夜地工作來完成這個專案。）
    - related collocation：`work around the clock`（日以繼夜地工作）
    - related phrase：`to finish the project`（為了完成這個專案）

### 82. 我想說「我需要處理警報問題」

- 結果：成功
- Session：`cmooc55m2004kj8uabhqs4ejk`
- 耗時：13.8s
- Intent：`suggest_candidates`
- AI 回覆：我先給你 2 句最常用、最自然的說法；目前沒有可錨定的既有單字卡，建議新增 alarm、issue、deal、address、handle 等單字卡方便收藏與連結。
- 候選：
  - sentence：`I need to deal with an alarm issue.`（我需要處理一個警報相關的問題。）
    - related collocation：`deal with an issue`（處理問題）
    - related collocation：`alarm issue`（警報問題／警報相關問題）
  - sentence：`I need to address the alarm problem.`（我需要處理／解決警報問題。）
    - related collocation：`address a problem`（處理／解決問題（較正式））
    - related collocation：`alarm problem`（警報問題）

### 83. 只翻譯：我想換房間，不要收藏候選

- 結果：成功
- Session：`cmooc55m2004kj8uabhqs4ejk`
- 耗時：8.6s
- Intent：`translate_only`
- AI 回覆：I’d like to change rooms.
- 候選：無

### 84. 我想知道 commit to a fitness routine 怎麼用

- 結果：成功
- Session：`cmooc55m2004kj8uabhqs4ejk`
- 耗時：13.1s
- Intent：`explain_usage`
- AI 回覆：「commit to + 名詞/動名詞」=「下定決心投入／承諾去做」，語氣比 decide 更強、帶有持續性；常用在習慣、計畫、長期目標。你這句可用在表達要長期固定健身。
- 候選：
  - sentence：`I’m committed to a fitness routine, even when I’m busy.`（我承諾（並持續投入）固定健身，即使我很忙也一樣。）
    - related collocation：`commit to a routine`（承諾並投入固定習慣／例行）
    - related phrase：`even when I’m busy`（即使我很忙的時候也…）

### 85. 如果時間不夠，我們先處理最重要的部分

- 結果：成功
- Session：`cmooc55m2004kj8uabhqs4ejk`
- 耗時：13.2s
- Intent：`analyze_sentence`
- AI 回覆：給你一個最自然、可直接套用的英文句；目前沒有可錨定的既有單字卡，建議新增 time、enough、handle、most important、part 等單字卡方便連結。
- 候選：
  - sentence：`If we don’t have enough time, let’s handle the most important part first.`（如果時間不夠，我們先處理最重要的部分。）
    - related clause：`If we don’t have enough time`（如果我們沒有足夠的時間）
    - related collocation：`handle the most important part`（處理最重要的部分）
    - related phrase：`first`（先／首先）

### 86. 雖然我們落後進度，還是可以追回來

- 結果：成功
- Session：`cmooc55m2004kj8uabhqs4ejk`
- 耗時：17.5s
- Intent：`analyze_sentence`
- AI 回覆：我先給你一個最自然的英文句並拆解重點；目前沒有可錨定的既有單字卡，建議新增 behind、schedule、catch up 等單字卡方便連結。
- 候選：
  - sentence：`Although we’re behind schedule, we can still catch up.`（雖然我們落後進度，還是可以追回來。）
    - related clause：`Although we’re behind schedule`（雖然我們落後進度）
    - related collocation：`behind schedule`（進度落後）
    - related phrase：`can still catch up`（還是可以追回來）

### 87. 我想說「這個流程讓事情更容易」

- 結果：成功
- Session：`cmooc55m2004kj8uabhqs4ejk`
- 耗時：24.3s
- Intent：`suggest_candidates`
- AI 回覆：這裡有 2 個最自然、可直接用在職場/產品語境的說法；目前可用既有卡片先錨定在 this/it，其餘如 process、workflow、make、easier 建議之後補單字卡。
- 候選：
  - sentence：`This process makes things easier.`（這個流程讓事情更容易。）
    - related phrase：`This process`（這個流程）
    - related collocation：`makes things easier`（讓事情更容易／更順）
  - sentence：`This workflow makes it easier.`（這個流程讓它（整件事）變得更容易。）
    - related phrase：`This workflow`（這個工作流程）
    - related collocation：`makes it easier`（讓它更容易／更省事）

### 88. Can you correct this: I need discuss this issue with manager.

- 結果：成功
- Session：`cmooc55m2004kj8uabhqs4ejk`
- 耗時：14.2s
- Intent：`correct_sentence`
- AI 回覆：較自然的改法是加上不定詞並補冠詞/所有格。
- 候選：
  - sentence：`I need to discuss this issue with my manager.`（我需要跟我的主管討論這個問題。）
    - related collocation：`discuss this issue`（討論這個問題）
    - related phrase：`with my manager`（跟我的主管）

### 89. 我想說「我們可能需要外部資源」

- 結果：成功
- Session：`cmooc55m2004kj8uabhqs4ejk`
- 耗時：20.2s
- Intent：`suggest_candidates`
- AI 回覆：這裡有兩個自然的說法；目前可用既有卡片先錨定在 people，建議之後補 external/resource/help/team 等單字卡方便連結。
- 候選：
  - sentence：`We might need some external resources.`（我們可能需要一些外部資源。）
    - related collocation：`external resources`（外部資源）
  - sentence：`We may need people outside the team to help.`（我們可能需要團隊以外的人來幫忙。）
    - related phrase：`people outside the team`（團隊以外的人）
    - related phrase：`to help`（來幫忙）

### 90. 如果會議提前結束，我們可以去吃午餐

- 結果：成功
- Session：`cmooc55m2004kj8uabhqs4ejk`
- 耗時：20.1s
- Intent：`analyze_sentence`
- AI 回覆：我用最自然的英文句幫你表達並拆解重點；目前可用既有卡片先錨定在 the/can，其餘如 meeting、end、early、lunch 建議之後補單字卡。
- 候選：
  - sentence：`If the meeting ends early, we can go grab lunch.`（如果會議提前結束，我們可以去吃午餐。）
    - related clause：`If the meeting ends early`（如果會議提前結束）
    - related phrase：`can go grab lunch`（可以去吃午餐）
    - related collocation：`grab lunch`（去吃午餐（較口語、常用））

### 91. 雖然門有問題，我們先不要換房間

- 結果：成功
- Session：`cmooc55m2004kj8uabhqs4ejk`
- 耗時：19.3s
- Intent：`analyze_sentence`
- AI 回覆：我先用最自然的英文句幫你表達並拆解重點；目前只能先錨定在既有的 the，其餘如 door、issue、change rooms 建議之後補單字卡方便連結。
- 候選：
  - sentence：`Although the door has an issue, let’s not change rooms for now.`（雖然門有問題，我們先不要換房間。）
    - related clause：`Although the door has an issue`（雖然門有問題）
    - related collocation：`change rooms`（換房間）
    - related phrase：`for now`（先暫時／目前）

### 92. 請幫我產生 travel 相關的語塊

- 結果：成功
- Session：`cmooc55m2004kj8uabhqs4ejk`
- 耗時：32.2s
- Intent：`suggest_candidates`
- AI 回覆：先給你幾句最常用的 travel 情境句，並拆出可收藏語塊；其餘像 flight/hotel/reservation/passport 等建議之後補單字卡更好連結。
- 候選：
  - sentence：`Can you book a hotel for one day?`（你可以幫我訂一晚飯店嗎？（直譯：訂一天））
    - related collocation：`book a hotel`（訂飯店）
    - related phrase：`for one day`（一天／一晚（依情境））
    - related phrase：`Can you`（你可以…嗎（禮貌請求））
  - sentence：`Can you call a taxi to the airport?`（你可以幫我叫一台計程車去機場嗎？）
    - related collocation：`call a taxi`（叫計程車）
    - related phrase：`to the airport`（去機場）
    - related phrase：`Can you`（你可以…嗎（禮貌請求））
  - sentence：`We can go home after the trip.`（旅行結束後我們可以回家。）
    - related collocation：`go home`（回家）
    - related phrase：`after the trip`（旅行之後／行程結束後）
    - related phrase：`We can`（我們可以…）

### 93. 我想說「我已經寄出文件了」

- 結果：成功
- Session：`cmooc55m2004kj8uabhqs4ejk`
- 耗時：17.3s
- Intent：`suggest_candidates`
- AI 回覆：這裡有兩個最常用的說法；目前只能先錨定在既有的 the，其餘如 send/document/email 建議之後補單字卡更好連結。
- 候選：
  - sentence：`I’ve already sent the documents.`（我已經把文件寄出去了。）
    - related collocation：`sent the documents`（寄出文件）
    - related phrase：`already`（已經）
  - sentence：`I already emailed the documents.`（我已經把文件用 email 寄出去了。）
    - related collocation：`emailed the documents`（把文件用 email 寄出）
    - related phrase：`already`（已經）

### 94. 搜尋收藏：make a reservation

- 結果：成功
- Session：`cmooc55m2004kj8uabhqs4ejk`
- 耗時：5.7s
- Intent：`find_existing`
- AI 回覆：目前搜尋結果沒有找到既有收藏「make a reservation」。如果你願意，我可以幫你產生可收藏的句子/語塊候選。
- 候選：無

### 95. 如果今天下大雨，我們就延後行程

- 結果：成功
- Session：`cmooc55m2004kj8uabhqs4ejk`
- 耗時：21.8s
- Intent：`analyze_sentence`
- AI 回覆：我用最自然的英文句幫你表達並拆解重點；目前只能先錨定在既有的 it/day/the，其餘如 rain/heavily/postpone/trip 建議之後補單字卡方便連結。
- 候選：
  - sentence：`If it rains heavily today, we’ll postpone the trip.`（如果今天下大雨，我們就延後行程。）
    - related clause：`If it rains heavily today`（如果今天下大雨）
    - related collocation：`rains heavily`（下大雨）
    - related collocation：`postpone the trip`（延後行程）

### 96. 雖然任務很困難，我們還是準時完成

- 結果：成功
- Session：`cmooc55m2004kj8uabhqs4ejk`
- 耗時：21.4s
- Intent：`analyze_sentence`
- AI 回覆：我用最自然的英文句幫你表達並拆解重點；目前只能先錨定在既有的 it，其餘如 task/challenging/finish/on time 建議之後補單字卡方便連結。
- 候選：
  - sentence：`Although it was a challenging task, we still finished on time.`（雖然任務很困難，我們還是準時完成。）
    - related clause：`Although it was a challenging task`（雖然這是一個很困難的任務）
    - related collocation：`a challenging task`（一個很有挑戰性的任務）
    - related collocation：`finished on time`（準時完成）

### 97. 我想把「我會盡快回覆」講自然一點

- 結果：成功
- Session：`cmooc55m2004kj8uabhqs4ejk`
- 耗時：19.7s
- Intent：`suggest_candidates`
- AI 回覆：下面兩句都很自然、適合職場訊息；建議之後新增 reply/respond、soon、possible、ASAP 等單字卡更好連結。
- 候選：
  - sentence：`I’ll get back to you as soon as I can.`（我會盡快回覆你。）
    - related collocation：`get back to you`（回覆你／再回你訊息）
    - related phrase：`as soon as I can`（我一有空就立刻／盡快）
  - sentence：`I’ll reply as soon as possible.`（我會盡快回覆。）
    - related phrase：`as soon as possible`（盡快／越快越好）

### 98. Can you make this natural: I need to check the room is ready.

- 結果：成功
- Session：`cmooc55m2004kj8uabhqs4ejk`
- 耗時：21.2s
- Intent：`correct_sentence`
- AI 回覆：更自然的說法是把後半句改成「whether/if + 子句」或用 make sure。
- 候選：
  - sentence：`I need to check whether the room is ready.`（我需要確認房間是否準備好了。）
    - related collocation：`check whether`（確認是否…）
    - related clause：`whether the room is ready`（房間是否準備好了）

### 99. 我想說「請幫我保留一張桌子」

- 結果：成功
- Session：`cmooc55m2004kj8uabhqs4ejk`
- 耗時：24.7s
- Intent：`suggest_candidates`
- AI 回覆：給你兩個最常用、最自然的餐廳說法；目前可先用既有卡片錨定在 can/you，其餘如 reserve/table 建議之後補單字卡更好連結。
- 候選：
  - sentence：`Can you reserve a table for us?`（可以幫我們保留一張桌子嗎？）
    - related collocation：`reserve a table`（保留／預訂一張桌子）
    - related phrase：`for us`（幫我們）
    - related phrase：`Can you`（你可以…嗎（禮貌請求））
  - sentence：`Can you save a table for us?`（可以幫我們留一張桌子嗎？（較口語））
    - related collocation：`save a table`（幫忙留桌）
    - related phrase：`for us`（幫我們）
    - related phrase：`Can you`（你可以…嗎（禮貌請求））

### 100. 請幫我拆解：Although the schedule is tight, we can still bring in extra resources.

- 結果：成功
- Session：`cmoocdhnu0000hhua6fpskgav`
- 耗時：15.2s
- Intent：`analyze_sentence`
- AI 回覆：已拆解句子；目前沒有可錨定的既有單字卡，建議可新增 schedule、tight、bring in、extra、resources 等卡片以便之後連結。
- 候選：
  - sentence：`Although the schedule is tight, we can still bring in extra resources.`（雖然時程很緊，我們仍然可以引進/調度額外資源。）
    - related clause：`Although the schedule is tight`（雖然時程很緊）
    - related collocation：`bring in extra resources`（引進／調度額外資源）
    - related collocation：`extra resources`（額外資源）
    - related phrase：`still bring in extra resources`（仍然引進／調度額外資源）

## 觀察

- 100 筆正式資料呼叫全部成功，沒有 timeout、schema error 或後端例外。
- 子句有穩定出現，尤其 because / although / if / when / while / before 類型。
- 片語與搭配詞也有穩定出現；但廣泛生成型任務（例如「產生 travel 相關語塊」）明顯較慢。
- `translate_only` 都沒有產生候選，符合「單純翻譯不跳收藏」的產品規則。
- `find_existing` 能使用既有收藏搜尋結果，但有些查詢會同時補充可新增候選；若未來想讓搜尋模式更純，可以再把 prompt 收斂成「搜尋不到時只詢問是否要產生」。
