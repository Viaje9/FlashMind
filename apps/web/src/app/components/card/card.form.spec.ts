import { describe, expect, it } from 'vitest';
import { createCardFormData } from './card.form';

describe('card.form', () => {
  it('應建立包含備註的卡片表單資料', () => {
    const meanings = [{ zhMeaning: '你好', enExample: 'Hello!', zhExample: '你好！' }];

    expect(createCardFormData('Hello', meanings, '比 hi 稍微正式')).toEqual({
      front: 'Hello',
      note: '比 hi 稍微正式',
      meanings,
    });
  });

  it('備註預設應為空字串', () => {
    expect(createCardFormData().note).toBe('');
  });
});
