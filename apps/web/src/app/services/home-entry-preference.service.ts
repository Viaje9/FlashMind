import { Injectable } from '@angular/core';

const HOME_ENTRY_STORAGE_KEY = 'flashmind.home.lastEntry';

type HomeEntryPath = '/decks' | '/speaking';

interface HomeEntryPreference {
  date: string;
  path: HomeEntryPath;
}

@Injectable({
  providedIn: 'root',
})
export class HomeEntryPreferenceService {
  save(path: HomeEntryPath): void {
    const payload: HomeEntryPreference = {
      date: this.getTodayKey(),
      path,
    };

    localStorage.setItem(HOME_ENTRY_STORAGE_KEY, JSON.stringify(payload));
  }

  getTodayPreferredPath(): HomeEntryPath | null {
    const raw = localStorage.getItem(HOME_ENTRY_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<HomeEntryPreference>;
      if (parsed.date !== this.getTodayKey()) {
        return null;
      }
      if (parsed.path === '/decks' || parsed.path === '/speaking') {
        return parsed.path;
      }
      return null;
    } catch {
      return null;
    }
  }

  private getTodayKey(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const day = `${now.getDate()}`.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
