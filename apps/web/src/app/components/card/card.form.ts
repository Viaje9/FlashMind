import { signal } from '@angular/core';
import { form, required } from '@angular/forms/signals';
import { CardMeaningDraft, validateCardMeaning } from './card.domain';

export interface CardFormData {
  front: string;
  meanings: CardMeaningDraft[];
}

export function createCardFormData(
  front = '',
  meanings: CardMeaningDraft[] = [{ zhMeaning: '', enExample: '', zhExample: '' }],
): CardFormData {
  return { front, meanings };
}

export function createCardForm(model: ReturnType<typeof signal<CardFormData>>) {
  return form(model, (f) => {
    required(f.front, { message: '請輸入正面內容' });
  });
}

export function validateMeaningsForSubmit(meanings: CardMeaningDraft[]): string | null {
  if (meanings.length === 0) {
    return '請至少新增一筆詞義';
  }

  for (let i = 0; i < meanings.length; i++) {
    const error = validateCardMeaning(meanings[i]);
    if (error) {
      return `第 ${i + 1} 筆詞義：${error}`;
    }
  }

  return null;
}
