import { describe, expect, it } from 'vitest';

import {
  filterTargetVocabulary,
  getTargetVocabularyBackNavigation,
  parseTargetVocabularyFilterPreference,
  getTargetVocabularyStatusCounts,
  parseTargetVocabularyImportJson,
  readStoredTargetVocabularyDeckId,
  resolveStoredTargetVocabularyDeckId,
  writeStoredTargetVocabularyDeckId,
} from './target-vocabulary.domain';

describe('target-vocabulary domain', () => {
  const items = [
    {
      id: '1',
      term: 'cooperation',
      normalizedTerm: 'cooperation',
      zhMeaning: '合作',
      status: 'UNSEEN' as const,
      recommendationCount: 0,
      useCount: 0,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: '2',
      term: 'figure out',
      normalizedTerm: 'figure out',
      zhMeaning: '弄清楚',
      status: 'PRACTICING' as const,
      recommendationCount: 2,
      useCount: 0,
      createdAt: '',
      updatedAt: '',
    },
  ];

  it('解析目標單字匯入 JSON 並標示無效項目', () => {
    const result = parseTargetVocabularyImportJson(
      JSON.stringify({
        words: [
          { term: ' cooperation ', zhMeaning: ' 合作；協作 ' },
          { term: '', zhMeaning: '功能' },
        ],
      }),
    );

    expect(result.error).toBeUndefined();
    expect(result.words[0]).toEqual({ term: 'cooperation', zhMeaning: '合作；協作' });
    expect(result.words[1].error).toBe('缺少英文單字或片語');
  });

  it('可依狀態與搜尋文字篩選', () => {
    expect(filterTargetVocabulary(items, 'UNSEEN', '合作')).toEqual([items[0]]);
    expect(filterTargetVocabulary(items, 'PRACTICING', 'figure')).toEqual([items[1]]);
  });

  it('計算各狀態數量', () => {
    expect(getTargetVocabularyStatusCounts(items)).toEqual({
      ALL: 2,
      UNSEEN: 1,
      PRACTICING: 1,
      USED: 0,
      ADDED: 0,
    });
  });

  it('從 Speaking 進入時應返回原本的語音對話', () => {
    expect(getTargetVocabularyBackNavigation('speaking', 'conversation-1')).toEqual({
      route: '/speaking',
      queryParams: { conversationId: 'conversation-1' },
    });
    expect(getTargetVocabularyBackNavigation('speaking', null)).toEqual({
      route: '/speaking',
      queryParams: undefined,
    });
  });

  it('非 Speaking 來源應返回首頁並忽略 conversationId', () => {
    expect(getTargetVocabularyBackNavigation(null, 'conversation-1')).toEqual({
      route: '/home',
      queryParams: undefined,
    });
  });

  it('應讀取有效的目標單字分頁偏好，無效值則回到待接觸', () => {
    expect(parseTargetVocabularyFilterPreference('PRACTICING')).toBe('PRACTICING');
    expect(parseTargetVocabularyFilterPreference('ADDED')).toBe('ADDED');
    expect(parseTargetVocabularyFilterPreference('ALL')).toBe('UNSEEN');
    expect(parseTargetVocabularyFilterPreference(null)).toBe('UNSEEN');
  });

  it('加入牌組時應記住有效的上次選擇，並忽略已不存在的牌組', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    writeStoredTargetVocabularyDeckId(storage, 'deck-2');

    expect(readStoredTargetVocabularyDeckId(storage)).toBe('deck-2');
    expect(
      resolveStoredTargetVocabularyDeckId(readStoredTargetVocabularyDeckId(storage), [
        { id: 'deck-1' },
        { id: 'deck-2' },
      ]),
    ).toBe('deck-2');
    expect(resolveStoredTargetVocabularyDeckId('missing', [{ id: 'deck-1' }])).toBeNull();
  });
});
