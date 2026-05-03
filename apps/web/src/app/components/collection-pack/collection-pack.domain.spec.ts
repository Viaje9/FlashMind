import { describe, expect, it } from 'vitest';
import {
  MOCK_COLLECTION_ITEMS,
  buildHighlightedSentence,
  filterCollectionItems,
  mapCollectionSuggestedCard,
  patchSuggestedCard,
  readStoredCollectionDeckId,
  removeStoredCollectionDeckId,
  resolveStoredCollectionDeckId,
  type CollectionBreakdownItem,
  writeStoredCollectionDeckId,
} from './collection-pack.domain';

describe('collection-pack domain helpers', () => {
  it('應依類型篩選收藏項目', () => {
    const result = filterCollectionItems(MOCK_COLLECTION_ITEMS, 'collocation', '');

    expect(result.map((item) => item.kind)).toEqual(['collocation']);
    expect(result[0]?.text).toBe('fall behind schedule');
  });

  it('應支援以英文、中文與來源單字搜尋', () => {
    expect(
      filterCollectionItems(MOCK_COLLECTION_ITEMS, 'all', 'resource').map((item) => item.id),
    ).toContain('sentence-project-delay');
    expect(
      filterCollectionItems(MOCK_COLLECTION_ITEMS, 'all', '訂位').map((item) => item.id),
    ).toEqual(['sentence-reservation']);
    expect(
      filterCollectionItems(MOCK_COLLECTION_ITEMS, 'all', 'itinerary').map((item) => item.id),
    ).toEqual(['sentence-trip-itinerary']);
  });

  it('應高亮句子中的多個語塊', () => {
    const chunks: CollectionBreakdownItem[] = [
      {
        id: 'fall-behind-schedule',
        kind: 'collocation',
        text: 'fall behind schedule',
        meaning: '進度落後',
      },
      {
        id: 'bring-in-extra-resources',
        kind: 'collocation',
        text: 'bring in extra resources',
        meaning: '投入額外資源',
      },
    ];

    const tokens = buildHighlightedSentence(
      'We started to fall behind schedule, so we decided to bring in extra resources.',
      chunks,
    );

    expect(
      tokens.filter((token) => token.kind === 'collocation').map((token) => token.text),
    ).toEqual(['fall behind schedule', 'bring in extra resources']);
  });

  it('找不到拆解片段時應回傳原句 fallback', () => {
    const tokens = buildHighlightedSentence('This sentence has no matching chunk.', [
      {
        id: 'missing',
        kind: 'clause',
        text: 'because the room is full',
        meaning: '因為房間滿了',
      },
    ]);

    expect(tokens).toEqual([{ text: 'This sentence has no matching chunk.' }]);
  });

  it('應將 API suggestedCards 轉成可新增單字候選 view model', () => {
    const result = mapCollectionSuggestedCard({
      id: ' suggest-restaurant ',
      front: ' restaurant ',
      meanings: [
        {
          zhMeaning: ' 餐廳 ',
          enExample: ' I need to book a table at the restaurant. ',
          zhExample: ' 我需要在那間餐廳訂位。 ',
        },
      ],
      reason: ' 主要情境字，目前找不到對應卡片。 ',
      existingCardId: null,
      added: false,
    });

    expect(result).toEqual({
      id: 'suggest-restaurant',
      front: 'restaurant',
      meanings: [
        {
          zhMeaning: '餐廳',
          enExample: 'I need to book a table at the restaurant.',
          zhExample: '我需要在那間餐廳訂位。',
        },
      ],
      reason: '主要情境字，目前找不到對應卡片。',
      existingCardId: null,
      added: false,
      status: 'ready',
      deckId: null,
      deckName: null,
    });
  });

  it('單字候選 id 為空時應使用 front 產生 fallback id，避免 UI 吃掉候選', () => {
    const result = mapCollectionSuggestedCard({
      id: '',
      front: ' sauce ',
      meanings: [
        {
          zhMeaning: ' 醬；醬汁 ',
          enExample: ' No sauce, please. ',
          zhExample: ' 不要醬，謝謝。 ',
        },
      ],
      reason: ' 點餐時的核心單字。 ',
      existingCardId: null,
      added: false,
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: 'suggested-sauce',
        front: 'sauce',
        status: 'ready',
      }),
    );
  });

  it('單字候選應可區分已存在與已加入狀態', () => {
    expect(
      mapCollectionSuggestedCard({
        id: 'existing',
        front: 'price',
        meanings: [{ zhMeaning: '價格' }],
        reason: '已學過',
        existingCardId: 'card-price',
      })?.status,
    ).toBe('existing');

    expect(
      mapCollectionSuggestedCard({
        id: 'added',
        front: 'discount',
        meanings: [{ zhMeaning: '折扣' }],
        reason: '剛加入',
        added: true,
      })?.status,
    ).toBe('added');
  });

  it('單字候選 patch 應只更新指定卡片狀態', () => {
    const cards = [
      mapCollectionSuggestedCard({
        id: 'restaurant',
        front: 'restaurant',
        meanings: [{ zhMeaning: '餐廳' }],
        reason: '主要情境字',
      })!,
      mapCollectionSuggestedCard({
        id: 'booked',
        front: 'booked',
        meanings: [{ zhMeaning: '被訂滿的' }],
        reason: '常見搭配',
      })!,
    ];

    const result = patchSuggestedCard(cards, 'booked', {
      status: 'adding',
    });

    expect(result.map((card) => card.status)).toEqual(['ready', 'adding']);
  });

  it('牌組 localStorage helper 應預選有效 deck 並忽略無效 deck', () => {
    const storage = new Map<string, string>();
    const storageLike = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    };

    writeStoredCollectionDeckId(storageLike, 'deck-2');

    expect(readStoredCollectionDeckId(storageLike)).toBe('deck-2');
    expect(
      resolveStoredCollectionDeckId(readStoredCollectionDeckId(storageLike), [
        { id: 'deck-1', name: 'Daily' },
        { id: 'deck-2', name: 'Travel' },
      ]),
    ).toBe('deck-2');
    expect(
      resolveStoredCollectionDeckId(readStoredCollectionDeckId(storageLike), [
        { id: 'deck-1', name: 'Daily' },
      ]),
    ).toBeNull();

    removeStoredCollectionDeckId(storageLike);
    expect(readStoredCollectionDeckId(storageLike)).toBeNull();
  });
});
