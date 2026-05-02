export type CollectionItemKind = 'sentence' | 'collocation' | 'phrase' | 'clause';
export type CollectionFilter = CollectionItemKind | 'all';

export interface CollectionBreakdownItem {
  id: string;
  kind: Exclude<CollectionItemKind, 'sentence'>;
  text: string;
  meaning: string;
  sourceWord?: string;
}

export interface CollectionItem {
  id: string;
  kind: CollectionItemKind;
  text: string;
  meaning: string;
  sourceWords: string[];
  breakdownItems: CollectionBreakdownItem[];
  relatedChunks: CollectionBreakdownItem[];
  relatedSentences: Array<{
    id: string;
    text: string;
    meaning: string;
  }>;
}

export interface CollectionSuggestion {
  id: string;
  kind: CollectionItemKind;
  text: string;
  meaning: string;
  sourceWord?: string;
  existing: boolean;
  added: boolean;
}

export interface CollectionChatGroup {
  id: string;
  userText: string;
  assistantText: string;
  suggestions: CollectionSuggestion[];
}

export interface HighlightToken {
  text: string;
  kind?: CollectionBreakdownItem['kind'];
}

export const COLLECTION_FILTERS: Array<{ value: CollectionFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'sentence', label: '句子' },
  { value: 'collocation', label: '搭配詞' },
  { value: 'phrase', label: '片語' },
  { value: 'clause', label: '子句' },
];

export const COLLECTION_KIND_LABEL: Record<CollectionItemKind, string> = {
  sentence: '句子',
  collocation: '搭配詞',
  phrase: '片語',
  clause: '子句',
};

export const MOCK_COLLECTION_ITEMS: CollectionItem[] = [
  {
    id: 'sentence-project-delay',
    kind: 'sentence',
    text: 'We started to fall behind schedule, so we decided to bring in extra resources.',
    meaning: '我們開始進度落後，所以決定投入額外資源。',
    sourceWords: ['schedule', 'resource'],
    breakdownItems: [
      {
        id: 'chunk-fall-behind-schedule',
        kind: 'collocation',
        text: 'fall behind schedule',
        meaning: '進度落後',
        sourceWord: 'schedule',
      },
      {
        id: 'chunk-bring-in-resources',
        kind: 'collocation',
        text: 'bring in extra resources',
        meaning: '投入額外資源',
        sourceWord: 'resource',
      },
      {
        id: 'chunk-so-we-decided',
        kind: 'clause',
        text: 'so we decided to bring in extra resources',
        meaning: '所以我們決定投入額外資源',
      },
    ],
    relatedChunks: [],
    relatedSentences: [],
  },
  {
    id: 'sentence-reservation',
    kind: 'sentence',
    text: 'I need to make a reservation before the restaurant gets fully booked.',
    meaning: '我需要在餐廳訂滿之前先訂位。',
    sourceWords: ['reservation'],
    breakdownItems: [
      {
        id: 'chunk-make-reservation',
        kind: 'collocation',
        text: 'make a reservation',
        meaning: '訂位、預約',
        sourceWord: 'reservation',
      },
      {
        id: 'chunk-before-fully-booked',
        kind: 'clause',
        text: 'before the restaurant gets fully booked',
        meaning: '在餐廳訂滿之前',
      },
    ],
    relatedChunks: [],
    relatedSentences: [],
  },
  {
    id: 'sentence-trip-itinerary',
    kind: 'sentence',
    text: 'During our trip, we tried to stick to our itinerary.',
    meaning: '在旅途中，我們試著照著行程走。',
    sourceWords: ['trip', 'itinerary'],
    breakdownItems: [
      {
        id: 'chunk-during-trip',
        kind: 'phrase',
        text: 'during our trip',
        meaning: '在我們旅途中',
      },
      {
        id: 'chunk-stick-to-itinerary',
        kind: 'collocation',
        text: 'stick to our itinerary',
        meaning: '照著行程走',
        sourceWord: 'itinerary',
      },
    ],
    relatedChunks: [],
    relatedSentences: [],
  },
  {
    id: 'collocation-fall-behind-schedule',
    kind: 'collocation',
    text: 'fall behind schedule',
    meaning: '進度落後',
    sourceWords: ['schedule'],
    breakdownItems: [],
    relatedChunks: [
      {
        id: 'related-after-falling-behind',
        kind: 'phrase',
        text: 'after falling behind schedule',
        meaning: '在進度落後之後',
      },
      {
        id: 'related-because-fell-behind',
        kind: 'clause',
        text: 'because we fell behind schedule',
        meaning: '因為我們進度落後',
      },
    ],
    relatedSentences: [],
  },
  {
    id: 'phrase-after-falling-behind',
    kind: 'phrase',
    text: 'after falling behind schedule',
    meaning: '在進度落後之後',
    sourceWords: ['schedule'],
    breakdownItems: [],
    relatedChunks: [
      {
        id: 'related-fall-behind-schedule',
        kind: 'collocation',
        text: 'fall behind schedule',
        meaning: '進度落後',
        sourceWord: 'schedule',
      },
    ],
    relatedSentences: [
      {
        id: 'related-sentence-project-delay',
        text: 'After falling behind schedule, we brought in extra resources.',
        meaning: '進度落後之後，我們投入了額外資源。',
      },
    ],
  },
  {
    id: 'clause-because-fell-behind',
    kind: 'clause',
    text: 'because we fell behind schedule',
    meaning: '因為我們進度落後',
    sourceWords: ['schedule'],
    breakdownItems: [],
    relatedChunks: [
      {
        id: 'related-fall-behind-schedule-2',
        kind: 'collocation',
        text: 'fall behind schedule',
        meaning: '進度落後',
        sourceWord: 'schedule',
      },
    ],
    relatedSentences: [
      {
        id: 'related-sentence-because-delay',
        text: 'Because we fell behind schedule, we had to adjust the plan.',
        meaning: '因為我們進度落後，所以必須調整計畫。',
      },
    ],
  },
];

export const INITIAL_CHAT_GROUPS: CollectionChatGroup[] = [
  {
    id: 'initial-reservation',
    userText: '我不知道「我要在餐廳訂滿之前先訂位」怎麼自然地說。',
    assistantText: '可以這樣說。我也幫你拆出幾個可以收藏的表達，點加號就能加入待收藏清單。',
    suggestions: [
      {
        id: 'suggestion-reservation-sentence',
        kind: 'sentence',
        text: 'I need to make a reservation before the restaurant gets fully booked.',
        meaning: '我需要在餐廳訂滿之前先訂位。',
        existing: false,
        added: false,
      },
      {
        id: 'suggestion-make-reservation',
        kind: 'collocation',
        text: 'make a reservation',
        meaning: '訂位、預約',
        sourceWord: 'reservation',
        existing: true,
        added: false,
      },
      {
        id: 'suggestion-before-booked',
        kind: 'clause',
        text: 'before the restaurant gets fully booked',
        meaning: '在餐廳訂滿之前',
        existing: false,
        added: false,
      },
    ],
  },
];

export function filterCollectionItems(
  items: CollectionItem[],
  filter: CollectionFilter,
  searchTerm: string,
): CollectionItem[] {
  const normalizedTerm = normalizeSearchTerm(searchTerm);

  return items.filter((item) => {
    const matchesFilter = filter === 'all' || item.kind === filter;
    if (!matchesFilter) return false;
    if (!normalizedTerm) return true;
    return getSearchText(item).includes(normalizedTerm);
  });
}

export function buildHighlightedSentence(
  sentence: string,
  breakdownItems: CollectionBreakdownItem[],
): HighlightToken[] {
  const lowerSentence = sentence.toLowerCase();
  const matches = breakdownItems
    .map((item) => {
      const start = lowerSentence.indexOf(item.text.toLowerCase());
      return start >= 0 ? { start, end: start + item.text.length, item } : null;
    })
    .filter((match): match is { start: number; end: number; item: CollectionBreakdownItem } =>
      Boolean(match),
    )
    .sort((left, right) => left.start - right.start || right.end - left.end);

  if (!matches.length) return [{ text: sentence }];

  const tokens: HighlightToken[] = [];
  let cursor = 0;

  for (const match of matches) {
    if (match.start < cursor) continue;
    if (match.start > cursor) {
      tokens.push({ text: sentence.slice(cursor, match.start) });
    }
    tokens.push({
      text: sentence.slice(match.start, match.end),
      kind: match.item.kind,
    });
    cursor = match.end;
  }

  if (cursor < sentence.length) {
    tokens.push({ text: sentence.slice(cursor) });
  }

  return tokens.length ? tokens : [{ text: sentence }];
}

export function createCollectionItemFromSuggestion(
  suggestion: CollectionSuggestion,
): CollectionItem {
  return {
    id: `added-${suggestion.id}`,
    kind: suggestion.kind,
    text: suggestion.text,
    meaning: suggestion.meaning,
    sourceWords: suggestion.sourceWord ? [suggestion.sourceWord] : [],
    breakdownItems: [],
    relatedChunks: [],
    relatedSentences: [],
  };
}

export function createDelayMeetingChatGroup(
  sequence: number,
  userText: string,
): CollectionChatGroup {
  return {
    id: `delay-meeting-${sequence}`,
    userText,
    assistantText: '可以，這裡有幾個更自然的說法。你可以收藏整句，也可以只收藏常用語塊。',
    suggestions: [
      {
        id: `suggestion-postpone-meeting-${sequence}`,
        kind: 'collocation',
        text: 'postpone the meeting',
        meaning: '延期會議',
        sourceWord: 'meeting',
        existing: false,
        added: false,
      },
    ],
  };
}

function normalizeSearchTerm(value: string): string {
  return value.trim().toLowerCase();
}

function getSearchText(item: CollectionItem): string {
  return [
    item.text,
    item.meaning,
    ...item.sourceWords,
    ...item.breakdownItems.flatMap((chunk) => [chunk.text, chunk.meaning, chunk.sourceWord ?? '']),
    ...item.relatedChunks.flatMap((chunk) => [chunk.text, chunk.meaning, chunk.sourceWord ?? '']),
    ...item.relatedSentences.flatMap((sentence) => [sentence.text, sentence.meaning]),
  ]
    .join(' ')
    .toLowerCase();
}
