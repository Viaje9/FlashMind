import { StudyCard } from '@flashmind/api-client';

/**
 * 學習評分類型
 */
export type StudyRating = 'known' | 'unfamiliar' | 'unknown';

/**
 * 學習統計
 */
export interface StudyStats {
  knownCount: number;
  unfamiliarCount: number;
  unknownCount: number;
  totalStudied: number;
}

/**
 * 將 StudyCard 轉換為前端的 StudyExample 格式
 */
export function mapMeaningsToExamples(card: StudyCard) {
  return card.meanings.map((m) => ({
    label: m.zhMeaning,
    sentence: m.enExample ?? '',
    translation: m.zhExample ?? '',
  }));
}

/**
 * 取得卡片的所有中文翻譯
 */
export function getTranslations(card: StudyCard): string[] {
  return card.meanings.map((m) => m.zhMeaning);
}

/**
 * 計算學習進度百分比
 */
export function calculateProgress(current: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((current / total) * 100);
}

/**
 * 建立初始統計
 */
export function createInitialStats(): StudyStats {
  return {
    knownCount: 0,
    unfamiliarCount: 0,
    unknownCount: 0,
    totalStudied: 0,
  };
}

/**
 * 更新統計
 */
export function updateStats(stats: StudyStats, rating: StudyRating): StudyStats {
  const newStats = { ...stats };
  switch (rating) {
    case 'known':
      newStats.knownCount++;
      break;
    case 'unfamiliar':
      newStats.unfamiliarCount++;
      break;
    case 'unknown':
      newStats.unknownCount++;
      break;
  }
  newStats.totalStudied++;
  return newStats;
}

/**
 * 檢查是否為「不知道」評分
 */
export function isUnknownRating(rating: StudyRating): boolean {
  return rating === 'unknown';
}
