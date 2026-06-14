import { ConfigService } from '@nestjs/config';

import { AgentsCollectionAiProvider } from './agents-collection-ai.provider';

describe('AgentsCollectionAiProvider', () => {
  function createProvider() {
    const tools = {
      getUserVocabularySummary: jest.fn(),
      searchUserCards: jest.fn(),
      searchCollectionItems: jest.fn(),
      normalizeText: (text: string) => text.trim().toLowerCase(),
      findCollectionItemsByText: jest.fn(),
    };

    return new AgentsCollectionAiProvider(
      tools as any,
      {
        get: jest.fn(),
      } as unknown as ConfigService,
    );
  }

  function createProviderWithConfig(config: Record<string, string>) {
    const tools = {
      getUserVocabularySummary: jest.fn(),
      searchUserCards: jest.fn(),
      searchCollectionItems: jest.fn(),
      normalizeText: (text: string) => text.trim().toLowerCase(),
      findCollectionItemsByText: jest.fn(),
    };

    return new AgentsCollectionAiProvider(
      tools as any,
      {
        get: jest.fn((key: string) => config[key]),
      } as unknown as ConfigService,
    );
  }

  function buildPrompt(message: string) {
    const provider = createProvider();

    return (provider as any).buildPrompt(
      {
        userId: 'user-1',
        sessionId: 'session-1',
        message,
      },
      {
        vocabularySummary: {
          totalCards: 3,
          sampleCards: [
            {
              id: 'card-schedule',
              front: 'schedule',
              meanings: [{ zhMeaning: '時程' }],
            },
            {
              id: 'card-deadline',
              front: 'deadline',
              meanings: [{ zhMeaning: '期限' }],
            },
            {
              id: 'card-project',
              front: 'project',
              meanings: [{ zhMeaning: '專案' }],
            },
          ],
        },
        searchedCards: [],
        existingCollections: [],
      },
    ) as string;
  }

  it('裸句子沒有明確翻譯意圖時，prompt 應要求分析句子並產生收藏候選', () => {
    const prompt = buildPrompt('我晚餐想吃雞肉飯');

    expect(prompt).toContain(
      '本輪意圖判斷：使用者只貼一句中文或英文，沒有其他明確意圖，請使用 analyze_sentence',
    );
    expect(prompt).toContain('裸句子不能判成 translate_only');
  });

  it('預設應使用 gpt-5.5 與 low reasoning effort', () => {
    const provider = createProvider();

    expect((provider as any).createAgentConfig()).toEqual(
      expect.objectContaining({
        model: 'gpt-5.5',
        modelSettings: {
          reasoning: {
            effort: 'low',
          },
        },
      }),
    );
  });

  it('可用環境設定覆蓋模型與 reasoning effort', () => {
    const provider = createProviderWithConfig({
      COLLECTION_AGENTS_MODEL: 'gpt-5.4-mini',
      COLLECTION_AGENTS_REASONING_EFFORT: 'minimal',
    });

    expect((provider as any).createAgentConfig()).toEqual(
      expect.objectContaining({
        model: 'gpt-5.4-mini',
        modelSettings: {
          reasoning: {
            effort: 'minimal',
          },
        },
      }),
    );
  });

  it('prompt 應明確要求把有主詞與動詞的 because/although 片段拆成子句', () => {
    const prompt = buildPrompt('雖然期限很緊，但我們還是可以完成專案');

    expect(prompt).toContain(
      '如果 sentence 內有 because、although、if、when、before、after、so 引導，且該片段有自己的主詞與限定動詞，必須優先拆成 clause',
    );
    expect(prompt).toContain(
      'because the vendor delayed the delivery（clause，因為供應商延誤交付）',
    );
    expect(prompt).toContain(
      'Although the deadline is tight（clause，雖然期限很緊）',
    );
  });

  it.each([
    ['只翻譯：我想延期會議，不要收藏候選', 'translate_only'],
    ['請修正：I very like this plan.', 'correct_sentence'],
    [
      'Can you make this natural: We delayed the meeting to tomorrow.',
      'correct_sentence',
    ],
    ['fall behind schedule 怎麼用？', 'explain_usage'],
    ['我有沒有收藏 fall behind schedule？', 'find_existing'],
    ['如果我要說「我想延期會議」可以怎麼說？', 'suggest_candidates'],
    ['我想說「我們會準時完成」', 'suggest_candidates'],
  ])('會根據明確意圖產生對應 policy：%s', (message, expectedIntent) => {
    const prompt = buildPrompt(message);

    expect(prompt).toContain(`請使用 ${expectedIntent}`);
  });

  it.each([
    '可以幫我想個練習口說的情境嗎',
    '給我三個 roleplay 任務',
    '選第一個',
    '再難一點',
    '換旅遊',
  ])('口說情境或 roleplay 延續指令不應產生收藏候選：%s', (message) => {
    const prompt = buildPrompt(message);

    expect(prompt).toContain('使用者想取得口說練習情境或延續 roleplay 任務');
    expect(prompt).toContain('candidates 和 suggestedCards 必須為空陣列');
  });

  it('口說情境中明確要求怎麼說時仍應產生可收藏候選', () => {
    const prompt = buildPrompt('在剛剛的口說情境裡，我想說「我需要延後會議」');

    expect(prompt).toContain('使用者想取得可收藏表達');
    expect(prompt).toContain('請使用 suggest_candidates');
  });

  it.each([
    '接下來不要回傳任何卡片，純聊天就好',
    '先不要給我收藏候選，只聊天',
    'chat only, no cards',
  ])('純聊天偏好指令應要求後續不產生收藏候選：%s', (message) => {
    const prompt = buildPrompt(message);

    expect(prompt).toContain('純聊天偏好延續規則');
    expect(prompt).toContain('使用者要求純聊天或不要回傳卡片');
    expect(prompt).toContain('candidates 和 suggestedCards 必須為空陣列');
  });

  it('prompt 應要求 suggestedCards 只放缺少的主要單字並提供快閃卡欄位', () => {
    const prompt = buildPrompt('我需要在餐廳訂滿前先訂位，幫我整理可收藏表達');

    expect(prompt).toContain('suggestedCards 規則');
    expect(prompt).toContain('主要、值得學、且使用者單字卡中找不到');
    expect(prompt).toContain('front 是單字或短片語');
    expect(prompt).toContain('meanings 至少一筆');
  });

  it('prompt 應要求中文怎麼說情境把翻譯後的缺少關鍵字放入 suggestedCards', () => {
    const prompt = buildPrompt(
      '我在餐廳點餐我想跟服務生說「不要醬」可以怎麼說',
    );

    expect(prompt).toContain('中文轉英文缺字規則');
    expect(prompt).toContain('即使該英文單字沒有出現在使用者原始輸入中');
    expect(prompt).toContain('front=sauce');
    expect(prompt).toContain('zhMeaning=醬');
    expect(prompt).toContain('suggestedCards 不可為空');
    expect(prompt).toContain('No sauce, please.');
    expect(prompt).toContain('without sauce');
    expect(prompt).toContain('請使用 suggest_candidates');
  });

  it('prompt 應禁止把功能字與禮貌詞當成 sourceCardIds', () => {
    const prompt = buildPrompt(
      '我在餐廳點餐我想跟服務生說「不要醬」可以怎麼說',
    );

    expect(prompt).toContain('sourceCardIds 品質規則');
    expect(prompt).toContain(
      '不要連結 no、please、could、would、can、have、without',
    );
  });

  it('parseResult 應清洗 suggestedCards 並保留 front 與 meanings', () => {
    const provider = createProvider();
    const result = (provider as any).parseResult(
      JSON.stringify({
        intent: 'suggest_candidates',
        message: '可以收藏這些表達，也建議補 restaurant。',
        candidates: [],
        suggestedCards: [
          {
            id: 'card-restaurant',
            front: ' restaurant ',
            meanings: [
              {
                zhMeaning: ' 餐廳 ',
                enExample: ' I need to book a table at the restaurant. ',
                zhExample: ' 我需要在那間餐廳訂位。 ',
              },
            ],
            reason: ' 這是句子的主要情境字。 ',
            existingCardId: null,
            added: false,
          },
          {
            id: 'invalid',
            front: 'empty-meaning',
            meanings: [],
            reason: '沒有詞義',
            existingCardId: null,
            added: false,
          },
        ],
      }),
    );

    expect(result.suggestedCards).toEqual([
      {
        id: 'card-restaurant',
        front: 'restaurant',
        meanings: [
          {
            zhMeaning: '餐廳',
            enExample: 'I need to book a table at the restaurant.',
            zhExample: '我需要在那間餐廳訂位。',
          },
        ],
        reason: '這是句子的主要情境字。',
        existingCardId: null,
        added: false,
      },
    ]);
  });

  it('parseResult 應替空白 suggestedCards id 產生 fallback id', () => {
    const provider = createProvider();
    const result = (provider as any).parseResult(
      JSON.stringify({
        intent: 'suggest_candidates',
        message: '可以補 sauce。',
        candidates: [],
        suggestedCards: [
          {
            id: '',
            front: 'sauce',
            meanings: [
              {
                zhMeaning: '醬；醬汁',
                enExample: 'No sauce, please.',
                zhExample: '不要醬，謝謝。',
              },
            ],
            reason: '點餐時的核心單字。',
            existingCardId: null,
            added: false,
          },
        ],
      }),
    );

    expect(result.suggestedCards[0]).toEqual(
      expect.objectContaining({
        id: 'suggested-sauce',
        front: 'sauce',
      }),
    );
  });

  it('已存在於使用者單字卡的單字不得保留在 suggestedCards', () => {
    const provider = createProvider();

    const result = (provider as any).filterSuggestedCards(
      [
        {
          id: 'suggest-price',
          front: 'price',
          meanings: [{ zhMeaning: '價格' }],
          reason: '用來談價格。',
          existingCardId: null,
          added: false,
        },
        {
          id: 'suggest-discount',
          front: 'discount',
          meanings: [{ zhMeaning: '折扣' }],
          reason: '用來談優惠。',
          existingCardId: null,
          added: false,
        },
      ],
      [{ id: 'card-price', front: 'price' }],
    );

    expect(result).toEqual([
      {
        id: 'suggest-discount',
        front: 'discount',
        meanings: [{ zhMeaning: '折扣' }],
        reason: '用來談優惠。',
        existingCardId: null,
        added: false,
      },
    ]);
  });

  it('進入系統前應移除功能字與禮貌詞的 sourceCardIds', () => {
    const provider = createProvider();

    const result = (provider as any).removeLowValueSourceCardIds(
      {
        intent: 'suggest_candidates',
        message: '可以這樣說。',
        candidates: [
          {
            kind: 'sentence',
            text: 'Could I have a receipt, please?',
            meaning: '可以給我收據嗎？',
            sourceCardIds: ['card-have', 'card-receipt'],
            relatedCandidates: [
              {
                type: 'sentence_has_collocation',
                kind: 'collocation',
                text: 'have a receipt',
                meaning: '拿收據',
                sourceCardIds: ['card-have', 'card-receipt'],
              },
            ],
          },
        ],
        suggestedCards: [],
      },
      [
        { id: 'card-have', front: 'have' },
        { id: 'card-receipt', front: 'receipt' },
      ],
    );

    expect(result.candidates[0].sourceCardIds).toEqual(['card-receipt']);
    expect(result.candidates[0].relatedCandidates[0].sourceCardIds).toEqual([
      'card-receipt',
    ]);
  });
});
