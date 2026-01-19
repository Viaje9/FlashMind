import { describe, it, expect } from 'vitest';
import {
  canGenerateContent,
  mapGeneratedMeaningToCardMeaning,
  mapGeneratedMeaningsToCardMeanings,
} from './ai.domain';
import type { GeneratedMeaning } from '@flashmind/api-client';
import type { CardMeaningDraft } from '../card/card.domain';

describe('ai.domain', () => {
  describe('canGenerateContent', () => {
    it('文字為空時應該回傳 false', () => {
      expect(canGenerateContent('')).toBe(false);
    });

    it('文字只有空白時應該回傳 false', () => {
      expect(canGenerateContent('   ')).toBe(false);
    });

    it('文字有內容時應該回傳 true', () => {
      expect(canGenerateContent('hello')).toBe(true);
    });

    it('文字有空白但有內容時應該回傳 true', () => {
      expect(canGenerateContent('  hello world  ')).toBe(true);
    });
  });

  describe('mapGeneratedMeaningToCardMeaning', () => {
    it('應該正確轉換完整的 GeneratedMeaning', () => {
      const generated: GeneratedMeaning = {
        zhMeaning: '你好',
        enExample: 'Hello, how are you?',
        zhExample: '你好，你好嗎？',
      };

      const result = mapGeneratedMeaningToCardMeaning(generated);

      expect(result).toEqual<CardMeaningDraft>({
        zhMeaning: '你好',
        enExample: 'Hello, how are you?',
        zhExample: '你好，你好嗎？',
      });
    });

    it('應該將 null 的 enExample 轉換為空字串', () => {
      const generated: GeneratedMeaning = {
        zhMeaning: '測試',
        enExample: null,
        zhExample: '測試翻譯',
      };

      const result = mapGeneratedMeaningToCardMeaning(generated);

      expect(result.enExample).toBe('');
    });

    it('應該將 null 的 zhExample 轉換為空字串', () => {
      const generated: GeneratedMeaning = {
        zhMeaning: '測試',
        enExample: 'Test example',
        zhExample: null,
      };

      const result = mapGeneratedMeaningToCardMeaning(generated);

      expect(result.zhExample).toBe('');
    });

    it('應該將 undefined 的欄位轉換為空字串', () => {
      const generated: GeneratedMeaning = {
        zhMeaning: '測試',
      };

      const result = mapGeneratedMeaningToCardMeaning(generated);

      expect(result).toEqual<CardMeaningDraft>({
        zhMeaning: '測試',
        enExample: '',
        zhExample: '',
      });
    });
  });

  describe('mapGeneratedMeaningsToCardMeanings', () => {
    it('應該正確轉換多筆 GeneratedMeaning', () => {
      const generatedList: GeneratedMeaning[] = [
        {
          zhMeaning: '第一個意思',
          enExample: 'First example',
          zhExample: '第一個例句',
        },
        {
          zhMeaning: '第二個意思',
          enExample: 'Second example',
          zhExample: '第二個例句',
        },
      ];

      const result = mapGeneratedMeaningsToCardMeanings(generatedList);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual<CardMeaningDraft>({
        zhMeaning: '第一個意思',
        enExample: 'First example',
        zhExample: '第一個例句',
      });
      expect(result[1]).toEqual<CardMeaningDraft>({
        zhMeaning: '第二個意思',
        enExample: 'Second example',
        zhExample: '第二個例句',
      });
    });

    it('空陣列應該回傳空陣列', () => {
      const result = mapGeneratedMeaningsToCardMeanings([]);

      expect(result).toEqual([]);
    });

    it('應該處理混合完整與不完整的資料', () => {
      const generatedList: GeneratedMeaning[] = [
        {
          zhMeaning: '完整',
          enExample: 'Complete',
          zhExample: '完整翻譯',
        },
        {
          zhMeaning: '只有中文',
        },
      ];

      const result = mapGeneratedMeaningsToCardMeanings(generatedList);

      expect(result).toHaveLength(2);
      expect(result[0].enExample).toBe('Complete');
      expect(result[1].enExample).toBe('');
      expect(result[1].zhExample).toBe('');
    });
  });
});
