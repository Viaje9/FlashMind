export type TargetVocabularyStatus = 'UNSEEN' | 'PRACTICING' | 'USED' | 'ADDED';
export type TargetVocabularyFilter = 'ALL' | TargetVocabularyStatus;

export interface TargetVocabularyItem {
  id: string;
  term: string;
  normalizedTerm: string;
  zhMeaning: string;
  status: TargetVocabularyStatus;
  recommendationCount: number;
  useCount: number;
  expressionContext?: string | null;
  naturalSentence?: string | null;
  recommendationReason?: string | null;
  addedCardId?: string | null;
  addedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedTargetVocabularyWord {
  term: string;
  zhMeaning: string;
  error?: string;
}

export interface TargetVocabularyBackNavigation {
  route: '/home' | '/speaking';
  queryParams?: { conversationId: string };
}

const TARGET_VOCABULARY_FILTERS: readonly TargetVocabularyFilter[] = [
  'UNSEEN',
  'PRACTICING',
  'USED',
  'ADDED',
];
const TARGET_VOCABULARY_LAST_DECK_STORAGE_KEY = 'flashmind.target-vocabulary.last-deck-id';

export function resolveStoredTargetVocabularyDeckId(
  storedDeckId: string | null | undefined,
  decks: ReadonlyArray<{ id: string }>,
): string | null {
  if (!storedDeckId) return null;
  return decks.some((deck) => deck.id === storedDeckId) ? storedDeckId : null;
}

export function readStoredTargetVocabularyDeckId(
  storage: Pick<Storage, 'getItem'> | undefined,
): string | null {
  try {
    return storage?.getItem(TARGET_VOCABULARY_LAST_DECK_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function writeStoredTargetVocabularyDeckId(
  storage: Pick<Storage, 'setItem'> | undefined,
  deckId: string,
): void {
  try {
    storage?.setItem(TARGET_VOCABULARY_LAST_DECK_STORAGE_KEY, deckId);
  } catch {
    // localStorage 在私密瀏覽或容量受限時可能不可用。
  }
}

export function parseTargetVocabularyFilterPreference(
  value: string | null,
): TargetVocabularyFilter {
  return TARGET_VOCABULARY_FILTERS.includes(value as TargetVocabularyFilter)
    ? (value as TargetVocabularyFilter)
    : 'UNSEEN';
}

export function getTargetVocabularyBackNavigation(
  from: string | null,
  conversationId: string | null,
): TargetVocabularyBackNavigation {
  if (from !== 'speaking') {
    return { route: '/home', queryParams: undefined };
  }

  const normalizedConversationId = conversationId?.trim();
  return {
    route: '/speaking',
    queryParams: normalizedConversationId
      ? { conversationId: normalizedConversationId }
      : undefined,
  };
}

export function parseTargetVocabularyImportJson(json: string): {
  words: ParsedTargetVocabularyWord[];
  error?: string;
} {
  if (!json.trim()) return { words: [] };

  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return { words: [], error: 'JSON 格式錯誤，請確認括號與逗號是否正確' };
  }

  if (!isRecord(value) || !Array.isArray(value['words'])) {
    return { words: [], error: 'JSON 格式錯誤：缺少 words 陣列' };
  }

  return {
    words: value['words'].map((raw, index) => {
      if (!isRecord(raw)) {
        return { term: `(項目 ${index + 1})`, zhMeaning: '', error: '項目格式錯誤' };
      }
      const term = typeof raw['term'] === 'string' ? raw['term'].trim() : '';
      const zhMeaning = typeof raw['zhMeaning'] === 'string' ? raw['zhMeaning'].trim() : '';
      const errors = [!term ? '缺少英文單字或片語' : '', !zhMeaning ? '缺少中文意思' : ''].filter(
        Boolean,
      );
      return {
        term: term || `(項目 ${index + 1})`,
        zhMeaning,
        ...(errors.length ? { error: errors.join('、') } : {}),
      };
    }),
  };
}

export function filterTargetVocabulary(
  items: TargetVocabularyItem[],
  status: TargetVocabularyFilter,
  query: string,
): TargetVocabularyItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return items.filter((item) => {
    const matchesStatus = status === 'ALL' || item.status === status;
    const matchesQuery =
      !normalizedQuery ||
      item.term.toLocaleLowerCase().includes(normalizedQuery) ||
      item.zhMeaning.toLocaleLowerCase().includes(normalizedQuery);
    return matchesStatus && matchesQuery;
  });
}

export function getTargetVocabularyStatusCounts(items: TargetVocabularyItem[]) {
  return items.reduce(
    (counts, item) => ({ ...counts, ALL: counts.ALL + 1, [item.status]: counts[item.status] + 1 }),
    { ALL: 0, UNSEEN: 0, PRACTICING: 0, USED: 0, ADDED: 0 },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
