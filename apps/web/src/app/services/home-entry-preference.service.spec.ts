import { describe, it, expect, beforeEach } from 'vitest';
import { HomeEntryPreferenceService } from './home-entry-preference.service';

const STORAGE_KEY = 'flashmind.home.lastEntry';

describe('HomeEntryPreferenceService', () => {
  let service: HomeEntryPreferenceService;

  beforeEach(() => {
    localStorage.clear();
    service = new HomeEntryPreferenceService();
  });

  it('應該儲存並讀取首頁入口偏好', () => {
    service.save('/speaking');

    expect(service.getPreferredPath()).toBe('/speaking');
  });

  it('即使儲存日期不是今天也應該讀取偏好', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        date: '2020-01-01',
        path: '/decks',
      }),
    );

    expect(service.getPreferredPath()).toBe('/decks');
  });

  it('儲存格式錯誤時應該回傳 null', () => {
    localStorage.setItem(STORAGE_KEY, '{');

    expect(service.getPreferredPath()).toBeNull();
  });

  it('不支援的路徑應該回傳 null', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        date: '2020-01-01',
        path: '/settings',
      }),
    );

    expect(service.getPreferredPath()).toBeNull();
  });
});
