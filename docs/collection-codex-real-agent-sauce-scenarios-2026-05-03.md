# 收藏包真實 Codex Agent 測試報告

- 日期：2026-05-03T06:36:57.259Z
- 測試方式：直接呼叫 `CodexCollectionAiProvider.runChat()`，使用真實 Codex SDK / 真實模型回覆。
- 模型設定：`gpt-5.5` + `low` reasoning effort。
- 單字庫設定：測試假資料包含 restaurant/order/server/menu/pay，以及 no/please/could/have/without 等低價值字；刻意不包含各情境目標字。
- 總結：11/11 通過。通過條件為「有命中預期 suggestedCards」且「沒有把低價值字 id 放進 sourceCardIds」。

## 總表

| #   | 情境        | 預期單字                          | 命中 | 低價值 source ids | 耗時    |
| --- | ----------- | --------------------------------- | ---- | ----------------- | ------- |
| 1   | sauce       | sauce                             | 是   | 無                | 12686ms |
| 2   | ice         | ice                               | 是   | 無                | 11242ms |
| 3   | cilantro    | cilantro / coriander              | 是   | 無                | 12017ms |
| 4   | straw       | straw                             | 是   | 無                | 16403ms |
| 5   | receipt     | receipt                           | 是   | 無                | 10929ms |
| 6   | onion       | onion / onions                    | 是   | 無                | 14315ms |
| 7   | salt        | salt / salty                      | 是   | 無                | 11111ms |
| 8   | spicy       | spicy / spice                     | 是   | 無                | 11958ms |
| 9   | peanut      | peanut / allergic / allergy       | 是   | 無                | 10366ms |
| 10  | split-bill  | split / bill / check / separately | 是   | 無                | 11623ms |
| 11  | reservation | reservation                       | 是   | 無                | 10085ms |

## 詳細結果

### 1. sauce

- 輸入：我在餐廳點餐我想跟服務生說「不要醬」可以怎麼說
- 測試重點：使用者提供的問題；中文缺字應推導 sauce。
- 預期 suggestedCards：sauce
- 結果：PASS
- 耗時：12686ms

```json
{
  "intent": "suggest_candidates",
  "message": "可以簡單說「No sauce, please.」；如果要更完整一點，也可以說「Could I have it without sauce, please?」",
  "candidates": [
    {
      "kind": "sentence",
      "text": "No sauce, please.",
      "meaning": "不要醬，謝謝。",
      "sourceCardIds": [],
      "relatedCandidates": [],
      "alreadySaved": false
    },
    {
      "kind": "sentence",
      "text": "Could I have it without sauce, please?",
      "meaning": "可以不要加醬嗎？",
      "sourceCardIds": [],
      "relatedCandidates": [
        {
          "type": "sentence_has_phrase",
          "kind": "phrase",
          "text": "without sauce",
          "meaning": "不加醬；不要醬",
          "sourceCardIds": []
        }
      ],
      "alreadySaved": false
    }
  ],
  "suggestedCards": [
    {
      "id": "",
      "front": "sauce",
      "meanings": [
        {
          "zhMeaning": "醬；醬料",
          "enExample": "No sauce, please.",
          "zhExample": "不要醬，謝謝。"
        }
      ],
      "reason": "「sauce」是餐廳點餐時表達「醬料」的核心單字，現有卡片中沒有。",
      "existingCardId": null,
      "added": false
    }
  ]
}
```

### 2. ice

- 輸入：我在咖啡店點飲料，想說「不要冰」可以怎麼說
- 測試重點：飲料客製化；中文缺字應推導 ice。
- 預期 suggestedCards：ice
- 結果：PASS
- 耗時：11242ms

```json
{
  "intent": "suggest_candidates",
  "message": "在咖啡店點飲料時，最自然簡短可以說「No ice, please.」；如果要完整一點，也可以說「Could I have it without ice?」",
  "candidates": [
    {
      "kind": "sentence",
      "text": "No ice, please.",
      "meaning": "不要冰，謝謝。",
      "sourceCardIds": [],
      "relatedCandidates": [
        {
          "type": "sentence_has_collocation",
          "kind": "collocation",
          "text": "no ice",
          "meaning": "不要冰",
          "sourceCardIds": []
        }
      ],
      "alreadySaved": false
    },
    {
      "kind": "sentence",
      "text": "Could I have it without ice?",
      "meaning": "可以幫我做成不要冰嗎？",
      "sourceCardIds": [],
      "relatedCandidates": [
        {
          "type": "sentence_has_phrase",
          "kind": "phrase",
          "text": "without ice",
          "meaning": "不加冰；不要冰",
          "sourceCardIds": []
        }
      ],
      "alreadySaved": false
    }
  ],
  "suggestedCards": [
    {
      "id": "suggested-ice",
      "front": "ice",
      "meanings": [
        {
          "zhMeaning": "冰；冰塊",
          "enExample": "No ice, please.",
          "zhExample": "不要冰，謝謝。"
        }
      ],
      "reason": "「ice」是表達飲料不要冰時最核心的單字，既有卡片中還沒有。",
      "existingCardId": null,
      "added": false
    }
  ]
}
```

### 3. cilantro

- 輸入：我在餐廳點餐，想跟服務生說「不要香菜」怎麼說
- 測試重點：餐點客製化；允許美式 cilantro 或英式 coriander。
- 預期 suggestedCards：cilantro / coriander
- 結果：PASS
- 耗時：12017ms

```json
{
  "intent": "suggest_candidates",
  "message": "可以說 “No cilantro, please.”；如果想更完整一點，也可以說 “Could I have it without cilantro?”",
  "candidates": [
    {
      "kind": "sentence",
      "text": "No cilantro, please.",
      "meaning": "不要香菜，麻煩了。",
      "sourceCardIds": [],
      "relatedCandidates": [],
      "alreadySaved": false
    },
    {
      "kind": "sentence",
      "text": "Could I have it without cilantro?",
      "meaning": "可以幫我做成不要香菜嗎？",
      "sourceCardIds": [],
      "relatedCandidates": [
        {
          "type": "sentence_has_phrase",
          "kind": "phrase",
          "text": "without cilantro",
          "meaning": "不要香菜；不含香菜",
          "sourceCardIds": []
        }
      ],
      "alreadySaved": false
    }
  ],
  "suggestedCards": [
    {
      "id": "",
      "front": "cilantro",
      "meanings": [
        {
          "zhMeaning": "香菜",
          "enExample": "No cilantro, please.",
          "zhExample": "不要香菜，麻煩了。"
        }
      ],
      "reason": "這是點餐時表達不要加某種配料的核心單字。",
      "existingCardId": null,
      "added": false
    }
  ]
}
```

### 4. straw

- 輸入：我買飲料時想跟店員說「不用吸管」可以怎麼說
- 測試重點：外帶飲料；中文缺字應推導 straw。
- 預期 suggestedCards：straw
- 結果：PASS
- 耗時：16403ms

```json
{
  "intent": "suggest_candidates",
  "message": "可以說 “No straw, please.”，更自然一點也可以說 “Without a straw, please.”",
  "candidates": [
    {
      "kind": "sentence",
      "text": "No straw, please.",
      "meaning": "不用吸管，謝謝。",
      "sourceCardIds": [],
      "relatedCandidates": [
        {
          "type": "sentence_has_collocation",
          "kind": "collocation",
          "text": "No straw",
          "meaning": "不要吸管",
          "sourceCardIds": []
        }
      ],
      "alreadySaved": false
    },
    {
      "kind": "sentence",
      "text": "Without a straw, please.",
      "meaning": "不要附吸管，謝謝。",
      "sourceCardIds": [],
      "relatedCandidates": [
        {
          "type": "sentence_has_phrase",
          "kind": "phrase",
          "text": "Without a straw",
          "meaning": "不含吸管；不用吸管",
          "sourceCardIds": []
        }
      ],
      "alreadySaved": false
    }
  ],
  "suggestedCards": [
    {
      "id": "",
      "front": "straw",
      "meanings": [
        {
          "zhMeaning": "吸管",
          "enExample": "No straw, please.",
          "zhExample": "不用吸管，謝謝。"
        }
      ],
      "reason": "這是表達「不用吸管」的核心名詞，既有單字卡中沒有。",
      "existingCardId": null,
      "added": false
    }
  ]
}
```

### 5. receipt

- 輸入：結帳時我想問「可以給我收據嗎」英文可以怎麼說
- 測試重點：結帳場景；中文缺字應推導 receipt。
- 預期 suggestedCards：receipt
- 結果：PASS
- 耗時：10929ms

```json
{
  "intent": "suggest_candidates",
  "message": "結帳時可以自然地說：Could I have a receipt, please? 也可以更直接說：Can I get a receipt, please?",
  "candidates": [
    {
      "kind": "sentence",
      "text": "Could I have a receipt, please?",
      "meaning": "可以給我收據嗎？",
      "sourceCardIds": [],
      "relatedCandidates": [
        {
          "type": "sentence_has_collocation",
          "kind": "collocation",
          "text": "have a receipt",
          "meaning": "拿到／取得收據",
          "sourceCardIds": []
        }
      ],
      "alreadySaved": false
    },
    {
      "kind": "sentence",
      "text": "Can I get a receipt, please?",
      "meaning": "可以給我收據嗎？",
      "sourceCardIds": [],
      "relatedCandidates": [
        {
          "type": "sentence_has_collocation",
          "kind": "collocation",
          "text": "get a receipt",
          "meaning": "拿到／取得收據",
          "sourceCardIds": []
        }
      ],
      "alreadySaved": false
    }
  ],
  "suggestedCards": [
    {
      "id": "suggest-receipt",
      "front": "receipt",
      "meanings": [
        {
          "zhMeaning": "收據",
          "enExample": "Could I have a receipt, please?",
          "zhExample": "可以給我收據嗎？"
        }
      ],
      "reason": "receipt 是結帳、付款後索取收據時的核心名詞，值得新增。",
      "existingCardId": null,
      "added": false
    }
  ]
}
```

### 6. onion

- 輸入：我點漢堡想說「不要洋蔥」英文怎麼說
- 測試重點：餐點配料；中文缺字應推導 onion。
- 預期 suggestedCards：onion / onions
- 結果：PASS
- 耗時：14315ms

```json
{
  "intent": "suggest_candidates",
  "message": "可以說：No onions, please. 點餐時很自然；也可以用 without onions 放進完整句子裡。",
  "candidates": [
    {
      "kind": "sentence",
      "text": "No onions, please.",
      "meaning": "不要洋蔥，謝謝。",
      "sourceCardIds": [],
      "relatedCandidates": [
        {
          "type": "sentence_has_phrase",
          "kind": "phrase",
          "text": "No onions",
          "meaning": "不要洋蔥",
          "sourceCardIds": []
        }
      ],
      "alreadySaved": false
    },
    {
      "kind": "sentence",
      "text": "I'd like a burger without onions, please.",
      "meaning": "我想要一個不要洋蔥的漢堡，謝謝。",
      "sourceCardIds": [],
      "relatedCandidates": [
        {
          "type": "sentence_has_phrase",
          "kind": "phrase",
          "text": "without onions",
          "meaning": "不含洋蔥；不要洋蔥",
          "sourceCardIds": []
        }
      ],
      "alreadySaved": false
    }
  ],
  "suggestedCards": [
    {
      "id": "suggest-onion",
      "front": "onion",
      "meanings": [
        {
          "zhMeaning": "洋蔥",
          "enExample": "I'd like a burger without onions, please.",
          "zhExample": "我想要一個不要洋蔥的漢堡，謝謝。"
        }
      ],
      "reason": "點餐時常需要表達是否要加洋蔥，值得新增。",
      "existingCardId": null,
      "added": false
    },
    {
      "id": "suggest-burger",
      "front": "burger",
      "meanings": [
        {
          "zhMeaning": "漢堡",
          "enExample": "I'd like a burger without onions, please.",
          "zhExample": "我想要一個不要洋蔥的漢堡，謝謝。"
        }
      ],
      "reason": "這是本句的核心食物名稱，之後點餐很常用。",
      "existingCardId": null,
      "added": false
    }
  ]
}
```

### 7. salt

- 輸入：我想請餐廳「少鹽一點」可以怎麼說
- 測試重點：口味調整；可能推導 salt 或 salty。
- 預期 suggestedCards：salt / salty
- 結果：PASS
- 耗時：11111ms

```json
{
  "intent": "suggest_candidates",
  "message": "可以說得很自然、禮貌：請餐廳把鹽放少一點。",
  "candidates": [
    {
      "kind": "sentence",
      "text": "Could you make it less salty, please?",
      "meaning": "可以請你做得沒那麼鹹嗎？",
      "sourceCardIds": [],
      "relatedCandidates": [
        {
          "type": "sentence_has_collocation",
          "kind": "collocation",
          "text": "make it less salty",
          "meaning": "把它做得沒那麼鹹",
          "sourceCardIds": []
        }
      ],
      "alreadySaved": false
    }
  ],
  "suggestedCards": [
    {
      "id": "salt",
      "front": "salt",
      "meanings": [
        {
          "zhMeaning": "鹽",
          "enExample": "Could you use less salt, please?",
          "zhExample": "可以請你少放一點鹽嗎？"
        }
      ],
      "reason": "「少鹽一點」的核心單字是 salt，適合新增成餐廳點餐表達。",
      "existingCardId": null,
      "added": false
    },
    {
      "id": "salty",
      "front": "salty",
      "meanings": [
        {
          "zhMeaning": "鹹的",
          "enExample": "This soup is too salty for me.",
          "zhExample": "這碗湯對我來說太鹹了。"
        }
      ],
      "reason": "salty 可用來自然表達食物鹹度，是點餐時常用的形容詞。",
      "existingCardId": null,
      "added": false
    }
  ]
}
```

### 8. spicy

- 輸入：我想跟服務生說「不要辣」英文怎麼說
- 測試重點：口味調整；可能推導 spicy 或 spice。
- 預期 suggestedCards：spicy / spice
- 結果：PASS
- 耗時：11958ms

```json
{
  "intent": "suggest_candidates",
  "message": "可以說得很簡短：No spice, please. 如果是在點餐時，也很自然說：Could I have it without spice?",
  "candidates": [
    {
      "kind": "sentence",
      "text": "No spice, please.",
      "meaning": "不要辣，謝謝。",
      "sourceCardIds": [],
      "relatedCandidates": [
        {
          "type": "sentence_has_collocation",
          "kind": "collocation",
          "text": "no spice",
          "meaning": "不要辣；不加辣",
          "sourceCardIds": []
        }
      ],
      "alreadySaved": false
    },
    {
      "kind": "sentence",
      "text": "Could I have it without spice?",
      "meaning": "可以不要加辣嗎？",
      "sourceCardIds": [],
      "relatedCandidates": [
        {
          "type": "sentence_has_phrase",
          "kind": "phrase",
          "text": "without spice",
          "meaning": "不加辣；不要辣",
          "sourceCardIds": []
        }
      ],
      "alreadySaved": false
    }
  ],
  "suggestedCards": [
    {
      "id": "spice",
      "front": "spice",
      "meanings": [
        {
          "zhMeaning": "辛香料；辣味",
          "enExample": "No spice, please.",
          "zhExample": "不要辣，謝謝。"
        }
      ],
      "reason": "spice 是表達「不要辣、不加辣」的核心單字，值得新增。",
      "existingCardId": null,
      "added": false
    }
  ]
}
```

### 9. peanut

- 輸入：我對花生過敏，想跟服務生說這句英文怎麼說
- 測試重點：過敏告知；至少應推導 peanut/allergic/allergy 之一。
- 預期 suggestedCards：peanut / allergic / allergy
- 結果：PASS
- 耗時：10366ms

```json
{
  "intent": "suggest_candidates",
  "message": "可以自然地說：I’m allergic to peanuts. 如果是在餐廳提醒服務生，也可以加上請他們確認餐點不含花生。",
  "candidates": [
    {
      "kind": "sentence",
      "text": "I’m allergic to peanuts.",
      "meaning": "我對花生過敏。",
      "sourceCardIds": [],
      "relatedCandidates": [
        {
          "type": "sentence_has_collocation",
          "kind": "collocation",
          "text": "allergic to peanuts",
          "meaning": "對花生過敏",
          "sourceCardIds": []
        }
      ],
      "alreadySaved": false
    }
  ],
  "suggestedCards": [
    {
      "id": "suggested-peanut",
      "front": "peanut",
      "meanings": [
        {
          "zhMeaning": "花生",
          "enExample": "I’m allergic to peanuts.",
          "zhExample": "我對花生過敏。"
        }
      ],
      "reason": "這是表達餐廳過敏需求的核心名詞，既有單字卡中尚未出現。",
      "existingCardId": null,
      "added": false
    },
    {
      "id": "suggested-allergic",
      "front": "allergic",
      "meanings": [
        {
          "zhMeaning": "過敏的",
          "enExample": "I’m allergic to peanuts.",
          "zhExample": "我對花生過敏。"
        }
      ],
      "reason": "這是說明過敏狀況的核心形容詞，適合新增到單字卡。",
      "existingCardId": null,
      "added": false
    }
  ]
}
```

### 10. split-bill

- 輸入：跟朋友吃飯結帳時想說「可以分開結帳嗎」英文怎麼說
- 測試重點：結帳互動；可能推導 pay separately / split the bill / separate checks。
- 預期 suggestedCards：split / bill / check / separately
- 結果：PASS
- 耗時：11623ms

```json
{
  "intent": "suggest_candidates",
  "message": "可以說：Can we split the bill? 如果想更禮貌一點，也可以說：Could we split the bill, please?",
  "candidates": [
    {
      "kind": "sentence",
      "text": "Can we split the bill?",
      "meaning": "可以分開結帳嗎？",
      "sourceCardIds": [],
      "relatedCandidates": [
        {
          "type": "sentence_has_collocation",
          "kind": "collocation",
          "text": "split the bill",
          "meaning": "分開付款；分攤帳單",
          "sourceCardIds": []
        }
      ],
      "alreadySaved": false
    },
    {
      "kind": "sentence",
      "text": "Could we split the bill, please?",
      "meaning": "可以麻煩幫我們分開結帳嗎？",
      "sourceCardIds": [],
      "relatedCandidates": [
        {
          "type": "sentence_has_collocation",
          "kind": "collocation",
          "text": "split the bill",
          "meaning": "分開付款；分攤帳單",
          "sourceCardIds": []
        }
      ],
      "alreadySaved": false
    }
  ],
  "suggestedCards": [
    {
      "id": "",
      "front": "split",
      "meanings": [
        {
          "zhMeaning": "分開；分攤",
          "enExample": "Can we split the bill?",
          "zhExample": "我們可以分開結帳嗎？"
        }
      ],
      "reason": "這是表達「分開結帳」的核心動詞，適合餐廳情境使用。",
      "existingCardId": null,
      "added": false
    },
    {
      "id": "",
      "front": "bill",
      "meanings": [
        {
          "zhMeaning": "帳單",
          "enExample": "Could we split the bill, please?",
          "zhExample": "可以麻煩幫我們分開結帳嗎？"
        }
      ],
      "reason": "想在餐廳談付款或結帳時，bill 是很常用的關鍵名詞。",
      "existingCardId": null,
      "added": false
    }
  ]
}
```

### 11. reservation

- 輸入：到餐廳時我想說「我有訂位」可以怎麼說
- 測試重點：抵達餐廳；中文缺字應推導 reservation。
- 預期 suggestedCards：reservation
- 結果：PASS
- 耗時：10085ms

```json
{
  "intent": "suggest_candidates",
  "message": "可以說：I have a reservation. 如果想更自然禮貌一點，也可以說：I have a reservation under my name.",
  "candidates": [
    {
      "kind": "sentence",
      "text": "I have a reservation.",
      "meaning": "我有訂位。",
      "sourceWord": "restaurant",
      "sourceCardIds": ["card-restaurant"],
      "relatedCandidates": [
        {
          "type": "sentence_has_collocation",
          "kind": "collocation",
          "text": "have a reservation",
          "meaning": "有訂位",
          "sourceCardIds": []
        }
      ],
      "alreadySaved": false
    },
    {
      "kind": "sentence",
      "text": "I have a reservation under my name.",
      "meaning": "我有用我的名字訂位。",
      "sourceWord": "restaurant",
      "sourceCardIds": ["card-restaurant"],
      "relatedCandidates": [
        {
          "type": "sentence_has_collocation",
          "kind": "collocation",
          "text": "have a reservation",
          "meaning": "有訂位",
          "sourceCardIds": []
        },
        {
          "type": "sentence_has_phrase",
          "kind": "phrase",
          "text": "under my name",
          "meaning": "用我的名字；登記在我的名下",
          "sourceCardIds": []
        }
      ],
      "alreadySaved": false
    }
  ],
  "suggestedCards": [
    {
      "id": "",
      "front": "reservation",
      "meanings": [
        {
          "zhMeaning": "訂位；預約",
          "enExample": "I have a reservation for two people.",
          "zhExample": "我有兩個人的訂位。"
        }
      ],
      "reason": "表達到餐廳已有訂位時，reservation 是最核心的單字。",
      "existingCardId": null,
      "added": false
    }
  ]
}
```
