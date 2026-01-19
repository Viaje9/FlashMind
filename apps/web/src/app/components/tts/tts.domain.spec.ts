import { describe, it, expect } from 'vitest';
import { canPlaySpeech, createAudioCacheKey, createWordAudioCacheKey } from './tts.domain';

describe('tts.domain', () => {
  describe('canPlaySpeech', () => {
    it('文字為空時應該回傳 false', () => {
      expect(canPlaySpeech('')).toBe(false);
    });

    it('文字只有空白時應該回傳 false', () => {
      expect(canPlaySpeech('   ')).toBe(false);
    });

    it('文字有內容時應該回傳 true', () => {
      expect(canPlaySpeech('hello')).toBe(true);
    });

    it('文字有空白但有內容時應該回傳 true', () => {
      expect(canPlaySpeech('  hello world  ')).toBe(true);
    });
  });

  describe('createAudioCacheKey', () => {
    it('應該根據文字建立句子快取鍵值', () => {
      const key = createAudioCacheKey('hello');
      expect(key).toBe('tts:sentence:hello');
    });

    it('應該移除前後空白', () => {
      const key = createAudioCacheKey('  hello  ');
      expect(key).toBe('tts:sentence:hello');
    });

    it('應該保留中間的空白', () => {
      const key = createAudioCacheKey('hello world');
      expect(key).toBe('tts:sentence:hello world');
    });

    it('相同文字應該產生相同鍵值', () => {
      const key1 = createAudioCacheKey('test');
      const key2 = createAudioCacheKey('test');
      expect(key1).toBe(key2);
    });

    it('不同文字應該產生不同鍵值', () => {
      const key1 = createAudioCacheKey('hello');
      const key2 = createAudioCacheKey('world');
      expect(key1).not.toBe(key2);
    });
  });

  describe('createWordAudioCacheKey', () => {
    it('應該根據文字建立單字快取鍵值', () => {
      const key = createWordAudioCacheKey('hello');
      expect(key).toBe('tts:word:hello');
    });

    it('應該移除前後空白', () => {
      const key = createWordAudioCacheKey('  hello  ');
      expect(key).toBe('tts:word:hello');
    });

    it('相同文字應該產生相同鍵值', () => {
      const key1 = createWordAudioCacheKey('test');
      const key2 = createWordAudioCacheKey('test');
      expect(key1).toBe(key2);
    });

    it('單字與句子鍵值應該不同', () => {
      const wordKey = createWordAudioCacheKey('hello');
      const sentenceKey = createAudioCacheKey('hello');
      expect(wordKey).not.toBe(sentenceKey);
    });
  });
});
