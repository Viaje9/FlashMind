import type { GeneratedMeaning } from '@flashmind/api-client';
import type { CardMeaningDraft } from '../card/card.domain';

export function canGenerateContent(text: string): boolean {
  return text.trim().length > 0;
}

export function mapGeneratedMeaningToCardMeaning(
  generated: GeneratedMeaning,
): CardMeaningDraft {
  return {
    zhMeaning: generated.zhMeaning,
    enExample: generated.enExample ?? '',
    zhExample: generated.zhExample ?? '',
  };
}

export function mapGeneratedMeaningsToCardMeanings(
  generatedList: GeneratedMeaning[],
): CardMeaningDraft[] {
  return generatedList.map(mapGeneratedMeaningToCardMeaning);
}
