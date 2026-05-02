import { ConfigService } from '@nestjs/config';

import { CodexCollectionAiProvider } from './codex-collection-ai.provider';

describe('CodexCollectionAiProvider', () => {
  function createProvider() {
    const tools = {
      getUserVocabularySummary: jest.fn(),
      searchUserCards: jest.fn(),
      searchCollectionItems: jest.fn(),
      normalizeText: (text: string) => text.trim().toLowerCase(),
      findCollectionItemsByText: jest.fn(),
    };

    return new CodexCollectionAiProvider(
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

    return new CodexCollectionAiProvider(
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

    expect((provider as any).createThreadOptions()).toEqual(
      expect.objectContaining({
        model: 'gpt-5.5',
        modelReasoningEffort: 'low',
      }),
    );
  });

  it('可用環境設定覆蓋模型與 reasoning effort', () => {
    const provider = createProviderWithConfig({
      COLLECTION_CODEX_MODEL: 'gpt-5.4-mini',
      COLLECTION_CODEX_REASONING_EFFORT: 'minimal',
    });

    expect((provider as any).createThreadOptions()).toEqual(
      expect.objectContaining({
        model: 'gpt-5.4-mini',
        modelReasoningEffort: 'minimal',
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
});
