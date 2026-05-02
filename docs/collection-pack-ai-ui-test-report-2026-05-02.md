# 收藏包 AI / UI 情境測試報告

日期：2026-05-02

## 測試範圍

- 實機 UI：使用 Chrome 開啟 `/collections/new`，測試新增收藏聊天視窗、AI 回傳後的候選卡片呈現、`新對話` 清空狀態。
- 合成 AI 批次：使用同一個 `CodexCollectionAiProvider`，但改用合成單字卡資料，避免批量外傳本機使用者 DB 的單字卡與既有收藏。
- 單元測試：前端新增收藏頁、後端 collection service/controller/tool/provider。

## 實機 UI 結果

### UI-1：新增收藏聊天視窗

我輸入：`我需要在餐廳訂滿之前先訂位`

AI 回覆：這句可以用「在餐廳客滿前先訂位」來表達；目前沒有可錨定的既有單字卡，建議新增 reservation / fully booked 等相關字卡。

畫面候選卡片結果：

- 句子：`I need to make a reservation before the restaurant is fully booked.`
- 搭配詞：`make a reservation`
- 子句：`before the restaurant is fully booked`
- 搭配詞：`fully booked`

結論：候選已經是獨立卡片，不再把句子、搭配詞、子句塞在同一張 card 裡。

### UI-2：新對話

我點擊：`新對話`

結果：目前對話與候選卡片清空，輸入框回到空白狀態，沒有送出新 request。

## 修正內容

- 前端把 `relatedCandidates` 攤平成獨立候選卡片，並以 `kind:text` 去重。
- 移除候選卡片內部的巢狀「關聯語塊」顯示，使畫面更接近 prototype。
- 新增 `新對話` 按鈕，清空目前 chat session 與訊息。
- 後端 prompt 意圖規則補上 `make this natural` / `sound natural`，避免英文修正請求被判成裸句分析。
- 後端 prompt 意圖規則補上「我想說」，讓這類輸入進入 `suggest_candidates`。
- 前端測試補上「句子底下同時有搭配詞與子句時，應攤平成獨立卡片」。

## 合成 AI 批次總覽

- 情境數：32
- Intent 統計：analyze_sentence 20、translate_only 1、correct_sentence 3、explain_usage 2、find_existing 2、suggest_candidates 4
- 候選語塊統計（含 relatedCandidates）：sentence 30、collocation 51、clause 18、phrase 21

## 32 個情境結果

### 1. 我需要在餐廳訂滿之前先訂位

- Intent：`analyze_sentence`
- AI 回覆：你這句很自然；建議把「訂滿」用 fully booked 表達（可考慮之後新增單字/片語卡）。
- 候選：
  - sentence：`I need to make a reservation before the restaurant is fully booked.`（我需要在餐廳訂滿之前先訂位。）
    - related collocation：`make a reservation`（訂位、預約）
    - related clause：`before the restaurant is fully booked`（在餐廳訂滿之前）
    - related collocation：`be fully booked`（（店家/房間）被訂滿）

### 2. 雖然期限很緊，但我們還是可以完成專案

- Intent：`analyze_sentence`
- AI 回覆：這句很適合用讓步句型 Although…；也能順便收藏 tight deadline 這種常見說法。
- 候選：
  - sentence：`Although the deadline is tight, we can still finish the project.`（雖然期限很緊，但我們還是可以完成專案。）
    - related collocation：`tight deadline`（緊迫的截止期限）
    - related clause：`Although the deadline is tight`（雖然期限很緊）
    - related collocation：`finish the project`（完成專案）

### 3. 因為客戶改了時程，我們開始落後進度

- Intent：`analyze_sentence`
- AI 回覆：建議用 because + 子句交代原因，後半句用 fall behind schedule 很道地。
- 候選：
  - sentence：`Because the client changed the schedule, we started to fall behind schedule.`（因為客戶改了時程，我們開始落後進度。）
    - related clause：`Because the client changed the schedule`（因為客戶改了時程）
    - related collocation：`change the schedule`（更改時程）
    - related collocation：`fall behind schedule`（進度落後）

### 4. 如果會議延後，我會更新行程

- Intent：`analyze_sentence`
- AI 回覆：用 if 引導條件子句很自然；「更新行程」用 update my itinerary 很道地。
- 候選：
  - sentence：`If the meeting is postponed, I'll update my itinerary.`（如果會議延後，我會更新行程。）
    - related clause：`If the meeting is postponed`（如果會議延後）
    - related collocation：`postpone the meeting`（延後會議）
    - related collocation：`update my itinerary`（更新我的行程）

### 5. 當你確認房間時，我應該在哪裡等？

- Intent：`analyze_sentence`
- AI 回覆：可以用 while 子句把「當…時」自然帶出來；confirm 也能順便練到。
- 候選：
  - sentence：`Where should I wait while you confirm the room?`（當你確認房間時，我應該在哪裡等？）
    - related clause：`while you confirm the room`（當你確認房間時）
    - related collocation：`confirm the room`（確認房間（是否已安排/可用））

### 6. 我想把會議往後延一天

- Intent：`analyze_sentence`
- AI 回覆：這句用 push the meeting back 很自然；「延一天」用 by one day 很好收藏。
- 候選：
  - sentence：`I'd like to push the meeting back by one day.`（我想把會議往後延一天。）
    - related collocation：`push the meeting back`（把會議往後延）
    - related phrase：`by one day`（延後一天）

### 7. 我需要提前完成專案

- Intent：`analyze_sentence`
- AI 回覆：「提前完成」最自然是 finish the project ahead of schedule；若想更精準可之後新增 schedule 單字卡。
- 候選：
  - sentence：`I need to finish the project ahead of schedule.`（我需要提前完成專案。）
    - related collocation：`finish the project`（完成專案）
    - related phrase：`ahead of schedule`（提前、比預定時程更早）

### 8. 我想預訂住宿

- Intent：`analyze_sentence`
- AI 回覆：「住宿」可用 a hotel room 表達；也可以把 book 跟 room 一起收藏成常用搭配。
- 候選：
  - sentence：`I'd like to book a hotel room.`（我想預訂住宿。）
    - related collocation：`book a hotel room`（預訂飯店房間）

### 9. 我想安排詳細行程

- Intent：`analyze_sentence`
- AI 回覆：「安排行程」用 plan / map out 很自然；這裡先用 itinerary 讓句子可錨定既有卡。
- 候選：
  - sentence：`I'd like to plan a detailed itinerary.`（我想安排詳細行程。）
    - related collocation：`plan an itinerary`（規劃行程）
    - related phrase：`a detailed itinerary`（一份詳細的行程）

### 10. 我們需要投入額外資源，因為進度落後

- Intent：`analyze_sentence`
- AI 回覆：用 because 子句交代原因很自然；「投入/調度資源」用 allocate resources 很到位。
- 候選：
  - sentence：`We need to allocate additional resources because we're falling behind schedule.`（我們需要投入額外資源，因為進度落後。）
    - related collocation：`allocate additional resources`（投入／調度額外資源）
    - related phrase：`additional resources`（額外資源）
    - related clause：`because we're falling behind schedule`（因為我們進度落後）
    - related collocation：`fall behind schedule`（進度落後）

### 11. 我想比較價格並找到好優惠

- Intent：`analyze_sentence`
- AI 回覆：可用這句自然表達你的需求；也整理了兩個最常用的搭配詞，方便直接收藏與套用。
- 候選：
  - sentence：`I want to compare prices and find a good deal.`（我想比較價格並找到好優惠。）
    - related collocation：`compare prices`（比較價格）
    - related collocation：`find a good deal`（找到好優惠／划算的交易）
  - collocation：`compare prices`（比較價格）
    - related phrase：`to compare prices online`（在線上比價）
  - collocation：`find a good deal`（找到好優惠／划算的交易）
    - related phrase：`to find a good deal on flights`（找到機票優惠）

### 12. 我很累但還是逼自己去健身房

- Intent：`analyze_sentence`
- AI 回覆：這句很自然、口語也常用；我也把句中可重複套用的片語拆出來方便收藏。
- 候選：
  - sentence：`I'm exhausted, but I still push myself to go to the gym.`（我很累，但我還是逼自己去健身房。）
    - related phrase：`push myself to go to the gym`（逼自己去健身房）
    - related collocation：`go to the gym`（去健身房）
  - collocation：`go to the gym`（去健身房）
    - related phrase：`after work, go to the gym`（下班後去健身房）

### 13. 如果飯店客滿，我們要換地方住

- Intent：`analyze_sentence`
- AI 回覆：這句最貼近原意；「飯店客滿」也拆成可重複使用的條件子句。建議另外新增 fully booked（客滿）這個詞。
- 候選：
  - sentence：`If the hotel is fully booked, we'll stay somewhere else.`（如果飯店客滿，我們就換地方住。）
    - related clause：`If the hotel is fully booked`（如果飯店客滿）
    - related phrase：`stay somewhere else`（換地方住／住別的地方）
    - related collocation：`fully booked`（客滿）
  - clause：`If the hotel is fully booked`（如果飯店客滿）
    - related collocation：`fully booked`（客滿）

### 14. 當你沉浸在另一種文化時，你會學得更快

- Intent：`analyze_sentence`
- AI 回覆：這句很自然；已拆出 when 條件子句可收藏。建議另外新增 immerse / immerse yourself in（沉浸於）這個核心表達。
- 候選：
  - sentence：`When you immerse yourself in another culture, you learn faster.`（當你沉浸在另一種文化時，你會學得更快。）
    - related clause：`When you immerse yourself in another culture`（當你沉浸在另一種文化時）
    - related collocation：`immerse yourself in`（沉浸於／投入在）
    - related phrase：`learn faster`（學得更快）
  - clause：`When you immerse yourself in another culture`（當你沉浸在另一種文化時）
    - related collocation：`immerse yourself in`（沉浸於／投入在）

### 15. 雖然行程很滿，我們還是想去那個熱門景點

- Intent：`analyze_sentence`
- AI 回覆：這句很貼近原意；已把 although 子句與可重複使用的搭配詞拆出來方便收藏。
- 候選：
  - sentence：`Although our itinerary is packed, we still want to visit that popular destination.`（雖然行程很滿，我們還是想去那個熱門景點。）
    - related clause：`Although our itinerary is packed`（雖然我們的行程很滿）
    - related collocation：`packed itinerary`（滿檔的行程）
    - related phrase：`visit that popular destination`（去那個熱門景點／目的地）
  - collocation：`packed itinerary`（滿檔的行程）
    - related phrase：`with a packed itinerary`（在行程很滿的情況下）
  - clause：`Although our itinerary is packed`（雖然我們的行程很滿）
    - related collocation：`packed itinerary`（滿檔的行程）

### 16. 只翻譯：我想延期會議，不要收藏候選

- Intent：`translate_only`
- AI 回覆：I want to postpone the meeting.
- 候選：無

### 17. 請修正：I very like this plan.

- Intent：`correct_sentence`
- AI 回覆：更自然的說法如下；也附上可收藏的常用搭配。
- 候選：
  - sentence：`I really like this plan.`（我真的很喜歡這個計畫。）
    - related collocation：`really like`（真的很喜歡）

### 18. fall behind schedule 怎麼用？

- Intent：`explain_usage`
- AI 回覆：`fall behind schedule` 用來說「進度落後／沒跟上時程」，常接原因子句或時間點。
- 候選：
  - collocation：`fall behind schedule`（進度落後／沒跟上時程）
    - related phrase：`fall behind schedule by two days`（進度落後兩天）
    - related clause：`because we fell behind schedule`（因為我們進度落後）
  - sentence：`We're falling behind schedule because the vendor delayed the delivery.`（我們進度落後，因為供應商延誤交付。）
    - related collocation：`fall behind schedule`（進度落後／沒跟上時程）
    - related clause：`because the vendor delayed the delivery`（因為供應商延誤交付）

### 19. 我有沒有收藏 make a reservation？

- Intent：`find_existing`
- AI 回覆：有，你已收藏 `make a reservation`（訂位、預約）。
- 候選：
  - collocation：`make a reservation`（訂位、預約），已在收藏包

### 20. heavy rain 怎麼用在句子裡？

- Intent：`explain_usage`
- AI 回覆：`heavy rain` 常用來描述「大雨」，多接在 `in / during / after` 或 `due to` 這類片語後面；建議新增 rain 這個單字卡，之後更好錨定。
- 候選：
  - sentence：`The game was delayed due to heavy rain.`（比賽因為大雨而延遲。）
    - related collocation：`heavy rain`（大雨）
    - related collocation：`was delayed`（被延遲／延後）
    - related phrase：`due to heavy rain`（因為大雨）

### 21. 請幫我把「我想確認預約」變成可以收藏的句子

- Intent：`suggest_candidates`
- AI 回覆：這句最常見也最禮貌；也附上可重複使用的搭配方便收藏。
- 候選：
  - sentence：`I'd like to confirm my reservation.`（我想確認我的預約。）
    - related collocation：`confirm a reservation`（確認預約／訂位）
    - related phrase：`confirm my reservation`（確認我的預約）
  - collocation：`confirm a reservation`（確認預約／訂位）
    - related phrase：`to confirm a reservation by email`（透過 email 確認預約）

### 22. 我明天要開會

- Intent：`analyze_sentence`
- AI 回覆：可用這句表達「我明天要開會」。其中固定搭配可先收「have a meeting」。
- 候選：
  - sentence：`I have a meeting tomorrow.`（我明天要開會。）
    - related collocation：`have a meeting`（開會）
    - related phrase：`tomorrow`（明天）

### 23. We fell behind schedule because the vendor delayed delivery.

- Intent：`analyze_sentence`
- AI 回覆：這句可用來說「因為供應商延誤交付，我們進度落後」。可先收藏進度相關搭配與 because 子句。
- 候選：
  - sentence：`We fell behind schedule because the vendor delayed delivery.`（因為供應商延誤交付，我們進度落後。）
    - related collocation：`fall behind schedule`（進度落後）
    - related clause：`because the vendor delayed delivery`（因為供應商延誤交付）

### 24. Can you make this natural: We delayed the meeting to tomorrow.

- Intent：`correct_sentence`
- AI 回覆：更自然可用「move/push the meeting to tomorrow」。兩個動詞都很常用、語氣也更口語。
- 候選：
  - sentence：`We moved the meeting to tomorrow.`（我們把會議改到明天。）
    - related collocation：`move the meeting`（調整／挪動會議時間）
    - related phrase：`to tomorrow`（改到明天）

### 25. 我想說「我們會準時完成」

- Intent：`suggest_candidates`
- AI 回覆：這裡給你一個最常用、好收藏的說法；句內也能拆出跟 deadline 相關的搭配。若你常講「如期」的語氣，建議另外新增單字卡：on time / on schedule。
- 候選：
  - sentence：`We’ll finish the project by the deadline.`（我們會在截止期限前完成專案。）
    - related collocation：`meet the deadline`（如期達成截止期限）
    - related phrase：`by the deadline`（在截止期限前／不晚於截止期限）
    - related collocation：`finish the project`（完成專案）

### 26. 我想說「我需要請朋友幫忙」

- Intent：`suggest_candidates`
- AI 回覆：這句最自然、也很好收藏；可拆出「ask … for help」這個常用搭配。
- 候選：
  - sentence：`I need to ask my friend for help.`（我需要請朋友幫忙。）
    - related collocation：`ask for help`（請求幫忙）
    - related collocation：`ask my friend for help`（請朋友幫忙）

### 27. 我想說「先付咖啡錢」

- Intent：`suggest_candidates`
- AI 回覆：用這句最自然；也能順便收藏跟 pay 有關的搭配。若你常講「咖啡」與「帳單」，建議新增單字卡：coffee / bill。
- 候選：
  - sentence：`Let me pay for the coffee first.`（讓我先付咖啡錢。）
    - related collocation：`pay for the coffee`（付咖啡錢）
    - related phrase：`first`（先、首先）

### 28. 如果鬧鐘一直響，我會請櫃台處理

- Intent：`analyze_sentence`
- AI 回覆：可用 if 子句表達條件，再接「請櫃台幫忙」的說法；這句拆解也很適合收藏。
- 候選：
  - sentence：`If the alarm keeps going off, I'll ask the front desk for help.`（如果鬧鐘一直響，我會請櫃台處理／幫忙。）
    - related clause：`If the alarm keeps going off`（如果鬧鐘一直響）
    - related collocation：`ask the front desk for help`（請櫃台幫忙）

### 29. 雖然房間有問題，我們還是先等你檢查

- Intent：`analyze_sentence`
- AI 回覆：可用 although 子句表達讓步，再接「先等你檢查」；句內也能拆出 room 與 wait 的常用片段。
- 候選：
  - sentence：`Although there’s an issue with the room, we’ll wait for you to check it first.`（雖然房間有問題，我們還是先等你檢查。）
    - related clause：`Although there’s an issue with the room`（雖然房間有問題）
    - related collocation：`an issue with the room`（房間有問題）
    - related collocation：`check it first`（先檢查一下）
    - related phrase：`wait for you to check it`（等你來檢查）

### 30. 我想把「門打不開」講得自然一點

- Intent：`correct_sentence`
- AI 回覆：最自然的說法通常用「won’t open / won’t unlock」。如果你要說「怎麼用力都打不開」，也可以用「I can’t get the door open」。
- 候選：
  - sentence：`The door won’t open.`（門打不開。）
    - related collocation：`won’t open`（打不開／無法打開（故障或卡住））
  - sentence：`I can’t get the door open.`（我怎麼弄都打不開門。）
    - related collocation：`get the door open`（把門打開（成功打開））

### 31. 搜尋收藏：postpone the meeting

- Intent：`find_existing`
- AI 回覆：目前既有收藏中沒有「postpone the meeting」相關項目；已找到一則與預約相關的收藏（make a reservation）。若你想把「延後會議」也做成收藏，我可以幫你產生自然的候選（例如 move/push the meeting back）。
- 候選：無

### 32. 新對話測試：如果供應商延遲交付，我們會重新安排時程

- Intent：`analyze_sentence`
- AI 回覆：這句很自然，用 if 子句講條件、後句講應對；也能拆出「延遲交付」和「調整時程」兩個好收藏的搭配。
- 候選：
  - sentence：`If the vendor delays the delivery, we'll adjust the schedule.`（如果供應商延遲交付，我們會重新安排時程。）
    - related clause：`If the vendor delays the delivery`（如果供應商延遲交付）
    - related collocation：`delay the delivery`（延遲交付／配送）
    - related collocation：`adjust the schedule`（調整時程）

## 觀察

- 子句有出來：because / although / if / while / when 類型都能產生 clause，例如 `because we're falling behind schedule`、`Although the deadline is tight`。
- 片語有出來：`by one day`、`ahead of schedule`、`due to heavy rain`、`wait for you to check it`。
- 搭配詞有出來：`make a reservation`、`fall behind schedule`、`compare prices`、`find a good deal`。
- `translate_only` 沒有候選，符合「單純翻譯不跳收藏」的規則。
- `find_existing` 可以辨識已存在收藏；合成測試中 `make a reservation` 被標成已在收藏包。
- 少數候選仍可再微調：例如 `meet the deadline` 被放在「我們會準時完成」的 relatedCandidates，但原句文字是 `by the deadline`，未來可以要求 relatedCandidates 優先完全出現在 sentence text 中，降低語意相關但非原文片段的候選。

## 驗證指令

- `pnpm --filter ./apps/web exec vitest run src/app/pages/collection-pack-new/collection-pack-new.component.spec.ts`：通過，3 tests。
- `pnpm --filter ./apps/api test -- collection`：通過，22 tests。

## 限制

- 我沒有批量使用你的真實 DB 單字卡跑 30+ 筆，因為這會把本機使用者單字卡與既有收藏傳到 Codex SDK，需要你明確同意。這份報告的 32 筆 AI 批次改用合成單字卡；真實 UI 只做了 1 筆抽測。
