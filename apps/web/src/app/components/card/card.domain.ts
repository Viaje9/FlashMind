export interface CardMeaningDraft {
  zhMeaning: string;
  enExample: string;
  zhExample: string;
}

export function validateCardFront(front: string): string | null {
  if (!front.trim()) {
    return '請輸入正面內容';
  }
  return null;
}

export function validateCardMeanings(meanings: CardMeaningDraft[]): string | null {
  if (meanings.length === 0) {
    return '請至少新增一筆詞義';
  }
  return null;
}

export function validateCardMeaning(meaning: CardMeaningDraft): string | null {
  if (!meaning.zhMeaning.trim()) {
    return '請輸入中文解釋';
  }
  return null;
}

export function getCardSummary(meanings: CardMeaningDraft[]): string {
  if (meanings.length === 0) {
    return '';
  }
  return meanings[0].zhMeaning;
}

export function canDeleteMeaning(meaningCount: number): boolean {
  return meaningCount > 1;
}

export function createEmptyMeaning(): CardMeaningDraft {
  return {
    zhMeaning: '',
    enExample: '',
    zhExample: '',
  };
}
