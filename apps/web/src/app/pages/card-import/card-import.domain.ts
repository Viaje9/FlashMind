export interface ParsedMeaning {
  zhMeaning: string;
  enExample?: string;
  zhExample?: string;
}

export interface ParsedCard {
  front: string;
  meanings: ParsedMeaning[];
  error?: string;
}

export interface ParseResult {
  cards: ParsedCard[];
  error?: string;
}

export interface ImportJsonData {
  cards?: unknown[];
}

export interface RawCardData {
  front?: unknown;
  meanings?: unknown[];
}

export function parseImportJson(jsonString: string): ParseResult {
  if (!jsonString.trim()) {
    return { cards: [], error: undefined };
  }

  let data: ImportJsonData;
  try {
    data = JSON.parse(jsonString) as ImportJsonData;
  } catch {
    return { cards: [], error: 'JSON 格式錯誤：請確認格式是否正確' };
  }

  if (!data.cards || !Array.isArray(data.cards)) {
    return { cards: [], error: 'JSON 格式錯誤：缺少 cards 陣列' };
  }

  const cards = data.cards.map((rawCard, index) => parseCard(rawCard as RawCardData, index));
  return { cards, error: undefined };
}

function parseCard(card: RawCardData, index: number): ParsedCard {
  const errors: string[] = [];

  const front = typeof card.front === 'string' ? card.front.trim() : '';
  if (!front) {
    errors.push('缺少正面內容');
  }

  let meanings: ParsedMeaning[] = [];
  if (!card.meanings || !Array.isArray(card.meanings) || card.meanings.length === 0) {
    errors.push('缺少詞義');
  } else {
    meanings = card.meanings
      .filter((m): m is Record<string, unknown> => m !== null && typeof m === 'object')
      .map((m) => ({
        zhMeaning: typeof m['zhMeaning'] === 'string' ? m['zhMeaning'] : '',
        enExample: typeof m['enExample'] === 'string' ? m['enExample'] : undefined,
        zhExample: typeof m['zhExample'] === 'string' ? m['zhExample'] : undefined,
      }));

    const hasValidMeaning = meanings.some((m) => m.zhMeaning.trim() !== '');
    if (!hasValidMeaning) {
      errors.push('缺少有效的中文解釋');
    }
  }

  return {
    front: front || `(卡片 ${index + 1})`,
    meanings,
    error: errors.length > 0 ? errors.join('、') : undefined,
  };
}

export function getValidCards(cards: ParsedCard[]): ParsedCard[] {
  return cards.filter((c) => !c.error);
}

export function getInvalidCards(cards: ParsedCard[]): ParsedCard[] {
  return cards.filter((c) => c.error);
}
