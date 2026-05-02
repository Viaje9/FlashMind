import { describe, expect, it } from 'vitest';
import {
  MOCK_COLLECTION_ITEMS,
  buildHighlightedSentence,
  filterCollectionItems,
  type CollectionBreakdownItem,
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
});
