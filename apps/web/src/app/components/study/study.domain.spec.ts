import { describe, it, expect, beforeEach } from 'vitest';
import {
  mapMeaningsToExamples,
  getTranslations,
  calculateProgress,
  createInitialStats,
  updateStats,
  isUnknownRating,
  StudyStats,
} from './study.domain';
import { StudyCard } from '@flashmind/api-client';

describe('study.domain', () => {
  const mockCard: StudyCard = {
    id: 'card-1',
    front: 'Hello',
    meanings: [
      {
        id: 'm1',
        zhMeaning: '你好',
        enExample: 'Hello, how are you?',
        zhExample: '你好，你好嗎？',
      },
      {
        id: 'm2',
        zhMeaning: '喂',
        enExample: 'Hello? Is anyone there?',
        zhExample: '喂？有人在嗎？',
      },
    ],
    state: 'NEW',
    isNew: true,
  };

  describe('mapMeaningsToExamples', () => {
    it('should convert card meanings to study examples', () => {
      const examples = mapMeaningsToExamples(mockCard);

      expect(examples).toHaveLength(2);
      expect(examples[0]).toEqual({
        label: '你好',
        sentence: 'Hello, how are you?',
        translation: '你好，你好嗎？',
      });
    });

    it('should handle missing example fields', () => {
      const cardWithoutExamples: StudyCard = {
        id: 'card-2',
        front: 'World',
        meanings: [{ id: 'm1', zhMeaning: '世界', enExample: null, zhExample: null }],
        state: 'NEW',
        isNew: true,
      };

      const examples = mapMeaningsToExamples(cardWithoutExamples);
      expect(examples[0].sentence).toBe('');
      expect(examples[0].translation).toBe('');
    });
  });

  describe('getTranslations', () => {
    it('should extract all Chinese translations from card', () => {
      const translations = getTranslations(mockCard);

      expect(translations).toEqual(['你好', '喂']);
    });
  });

  describe('calculateProgress', () => {
    it('should calculate correct percentage', () => {
      expect(calculateProgress(25, 100)).toBe(25);
      expect(calculateProgress(1, 3)).toBe(33);
      expect(calculateProgress(50, 50)).toBe(100);
    });

    it('should return 0 when total is 0', () => {
      expect(calculateProgress(0, 0)).toBe(0);
    });
  });

  describe('createInitialStats', () => {
    it('should create empty stats', () => {
      const stats = createInitialStats();

      expect(stats).toEqual({
        knownCount: 0,
        unfamiliarCount: 0,
        unknownCount: 0,
        totalStudied: 0,
      });
    });
  });

  describe('updateStats', () => {
    let stats: StudyStats;

    beforeEach(() => {
      stats = createInitialStats();
    });

    it('should increment knownCount for known rating', () => {
      const updated = updateStats(stats, 'known');

      expect(updated.knownCount).toBe(1);
      expect(updated.totalStudied).toBe(1);
    });

    it('should increment unfamiliarCount for unfamiliar rating', () => {
      const updated = updateStats(stats, 'unfamiliar');

      expect(updated.unfamiliarCount).toBe(1);
      expect(updated.totalStudied).toBe(1);
    });

    it('should increment unknownCount for unknown rating', () => {
      const updated = updateStats(stats, 'unknown');

      expect(updated.unknownCount).toBe(1);
      expect(updated.totalStudied).toBe(1);
    });

    it('should not mutate original stats', () => {
      const original = createInitialStats();
      updateStats(original, 'known');

      expect(original.knownCount).toBe(0);
    });
  });

  describe('isUnknownRating', () => {
    it('should return true for unknown rating', () => {
      expect(isUnknownRating('unknown')).toBe(true);
    });

    it('should return false for other ratings', () => {
      expect(isUnknownRating('known')).toBe(false);
      expect(isUnknownRating('unfamiliar')).toBe(false);
    });
  });
});
