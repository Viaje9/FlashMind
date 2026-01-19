import { describe, it, expect } from 'vitest';
import {
  parseImportJson,
  getValidCards,
  getInvalidCards,
  ParsedCard,
} from './card-import.domain';

describe('card-import.domain', () => {
  describe('parseImportJson', () => {
    it('解析有效 JSON 應該回傳正確的卡片', () => {
      const json = JSON.stringify({
        cards: [
          {
            front: 'hello',
            meanings: [{ zhMeaning: '你好', enExample: 'Hello!', zhExample: '你好！' }],
          },
          {
            front: 'world',
            meanings: [{ zhMeaning: '世界' }],
          },
        ],
      });

      const result = parseImportJson(json);

      expect(result.error).toBeUndefined();
      expect(result.cards.length).toBe(2);
      expect(result.cards[0].front).toBe('hello');
      expect(result.cards[0].meanings[0].zhMeaning).toBe('你好');
      expect(result.cards[0].error).toBeUndefined();
      expect(result.cards[1].front).toBe('world');
      expect(result.cards[1].error).toBeUndefined();
    });

    it('空輸入應該回傳空陣列', () => {
      const result = parseImportJson('');

      expect(result.error).toBeUndefined();
      expect(result.cards.length).toBe(0);
    });

    it('只有空白應該回傳空陣列', () => {
      const result = parseImportJson('   ');

      expect(result.error).toBeUndefined();
      expect(result.cards.length).toBe(0);
    });

    it('無效 JSON 應該回傳錯誤', () => {
      const result = parseImportJson('not valid json');

      expect(result.error).toBe('JSON 格式錯誤：請確認格式是否正確');
      expect(result.cards.length).toBe(0);
    });

    it('缺少 cards 陣列應該回傳錯誤', () => {
      const result = parseImportJson(JSON.stringify({ data: [] }));

      expect(result.error).toBe('JSON 格式錯誤：缺少 cards 陣列');
      expect(result.cards.length).toBe(0);
    });

    it('cards 不是陣列應該回傳錯誤', () => {
      const result = parseImportJson(JSON.stringify({ cards: 'not array' }));

      expect(result.error).toBe('JSON 格式錯誤：缺少 cards 陣列');
      expect(result.cards.length).toBe(0);
    });

    it('缺少 front 應該標示錯誤', () => {
      const json = JSON.stringify({
        cards: [{ meanings: [{ zhMeaning: '你好' }] }],
      });

      const result = parseImportJson(json);

      expect(result.cards[0].error).toContain('缺少正面內容');
    });

    it('front 為空字串應該標示錯誤', () => {
      const json = JSON.stringify({
        cards: [{ front: '', meanings: [{ zhMeaning: '你好' }] }],
      });

      const result = parseImportJson(json);

      expect(result.cards[0].error).toContain('缺少正面內容');
    });

    it('front 只有空白應該標示錯誤', () => {
      const json = JSON.stringify({
        cards: [{ front: '   ', meanings: [{ zhMeaning: '你好' }] }],
      });

      const result = parseImportJson(json);

      expect(result.cards[0].error).toContain('缺少正面內容');
    });

    it('缺少 meanings 應該標示錯誤', () => {
      const json = JSON.stringify({
        cards: [{ front: 'hello' }],
      });

      const result = parseImportJson(json);

      expect(result.cards[0].error).toContain('缺少詞義');
    });

    it('meanings 為空陣列應該標示錯誤', () => {
      const json = JSON.stringify({
        cards: [{ front: 'hello', meanings: [] }],
      });

      const result = parseImportJson(json);

      expect(result.cards[0].error).toContain('缺少詞義');
    });

    it('meanings 缺少有效的 zhMeaning 應該標示錯誤', () => {
      const json = JSON.stringify({
        cards: [{ front: 'hello', meanings: [{ zhMeaning: '' }] }],
      });

      const result = parseImportJson(json);

      expect(result.cards[0].error).toContain('缺少有效的中文解釋');
    });

    it('多個錯誤應該用頓號連接', () => {
      const json = JSON.stringify({
        cards: [{ front: '', meanings: [] }],
      });

      const result = parseImportJson(json);

      expect(result.cards[0].error).toBe('缺少正面內容、缺少詞義');
    });

    it('缺少 front 時應該用預設名稱', () => {
      const json = JSON.stringify({
        cards: [{ meanings: [{ zhMeaning: '你好' }] }],
      });

      const result = parseImportJson(json);

      expect(result.cards[0].front).toBe('(卡片 1)');
    });

    it('選填欄位可以省略', () => {
      const json = JSON.stringify({
        cards: [
          {
            front: 'hello',
            meanings: [{ zhMeaning: '你好' }],
          },
        ],
      });

      const result = parseImportJson(json);

      expect(result.cards[0].error).toBeUndefined();
      expect(result.cards[0].meanings[0].enExample).toBeUndefined();
      expect(result.cards[0].meanings[0].zhExample).toBeUndefined();
    });
  });

  describe('getValidCards', () => {
    it('應該過濾出沒有錯誤的卡片', () => {
      const cards: ParsedCard[] = [
        { front: 'hello', meanings: [{ zhMeaning: '你好' }] },
        { front: 'world', meanings: [{ zhMeaning: '世界' }], error: '有錯誤' },
      ];

      const result = getValidCards(cards);

      expect(result.length).toBe(1);
      expect(result[0].front).toBe('hello');
    });
  });

  describe('getInvalidCards', () => {
    it('應該過濾出有錯誤的卡片', () => {
      const cards: ParsedCard[] = [
        { front: 'hello', meanings: [{ zhMeaning: '你好' }] },
        { front: 'world', meanings: [{ zhMeaning: '世界' }], error: '有錯誤' },
      ];

      const result = getInvalidCards(cards);

      expect(result.length).toBe(1);
      expect(result[0].front).toBe('world');
    });
  });
});
