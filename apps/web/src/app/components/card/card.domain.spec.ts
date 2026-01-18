import { describe, it, expect } from 'vitest';
import {
  validateCardFront,
  validateCardMeanings,
  validateCardMeaning,
  getCardSummary,
  canDeleteMeaning,
  createEmptyMeaning,
} from './card.domain';

describe('card.domain', () => {
  describe('validateCardFront', () => {
    it('正面為空時應該回傳錯誤', () => {
      expect(validateCardFront('')).toBe('請輸入正面內容');
    });

    it('正面只有空白時應該回傳錯誤', () => {
      expect(validateCardFront('   ')).toBe('請輸入正面內容');
    });

    it('正面有內容時應該回傳 null', () => {
      expect(validateCardFront('Hello')).toBeNull();
    });
  });

  describe('validateCardMeanings', () => {
    it('詞義列表為空時應該回傳錯誤', () => {
      expect(validateCardMeanings([])).toBe('請至少新增一筆詞義');
    });

    it('詞義列表有內容時應該回傳 null', () => {
      const meanings = [{ zhMeaning: '你好', enExample: '', zhExample: '' }];
      expect(validateCardMeanings(meanings)).toBeNull();
    });
  });

  describe('validateCardMeaning', () => {
    it('中文解釋為空時應該回傳錯誤', () => {
      const meaning = { zhMeaning: '', enExample: '', zhExample: '' };
      expect(validateCardMeaning(meaning)).toBe('請輸入中文解釋');
    });

    it('中文解釋只有空白時應該回傳錯誤', () => {
      const meaning = { zhMeaning: '   ', enExample: '', zhExample: '' };
      expect(validateCardMeaning(meaning)).toBe('請輸入中文解釋');
    });

    it('中文解釋有內容時應該回傳 null', () => {
      const meaning = { zhMeaning: '你好', enExample: '', zhExample: '' };
      expect(validateCardMeaning(meaning)).toBeNull();
    });
  });

  describe('getCardSummary', () => {
    it('應該回傳第一筆詞義的中文解釋', () => {
      const meanings = [
        { zhMeaning: '你好', enExample: '', zhExample: '' },
        { zhMeaning: '喂', enExample: '', zhExample: '' },
      ];
      expect(getCardSummary(meanings)).toBe('你好');
    });

    it('詞義列表為空時應該回傳空字串', () => {
      expect(getCardSummary([])).toBe('');
    });
  });

  describe('canDeleteMeaning', () => {
    it('只有一筆詞義時應該回傳 false', () => {
      expect(canDeleteMeaning(1)).toBe(false);
    });

    it('有兩筆以上詞義時應該回傳 true', () => {
      expect(canDeleteMeaning(2)).toBe(true);
      expect(canDeleteMeaning(5)).toBe(true);
    });
  });

  describe('createEmptyMeaning', () => {
    it('應該回傳空白的詞義物件', () => {
      const meaning = createEmptyMeaning();
      expect(meaning).toEqual({
        zhMeaning: '',
        enExample: '',
        zhExample: '',
      });
    });
  });
});
