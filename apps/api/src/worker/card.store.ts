import type { D1Database } from '@cloudflare/workers-types';
import type { CardRow, CardStore, MeaningRow } from './card.service';

type DatabaseCard = Omit<CardRow, 'summary'>;

export class D1CardStore implements CardStore {
  constructor(private readonly db: D1Database) {}

  async findDeck(id: string) {
    const row = await this.db
      .prepare('SELECT userId, enableReverse FROM "Deck" WHERE id = ?')
      .bind(id)
      .first<{ userId: string; enableReverse: number }>();
    return row
      ? { userId: row.userId, enableReverse: row.enableReverse === 1 }
      : null;
  }

  async listCards(deckId: string): Promise<CardRow[]> {
    const [cards, meanings] = await this.db.batch([
      this.db
        .prepare(
          'SELECT * FROM "Card" WHERE deckId = ? ORDER BY createdAt DESC',
        )
        .bind(deckId),
      this.db
        .prepare(
          'SELECT m.cardId, m.zhMeaning FROM "CardMeaning" m JOIN "Card" c ON c.id = m.cardId WHERE c.deckId = ? ORDER BY m.sortOrder ASC',
        )
        .bind(deckId),
    ]);
    const firstMeaning = new Map<string, string>();
    for (const meaning of meanings.results as Array<{
      cardId: string;
      zhMeaning: string;
    }>) {
      if (!firstMeaning.has(meaning.cardId))
        firstMeaning.set(meaning.cardId, meaning.zhMeaning);
    }
    return (cards.results as DatabaseCard[]).map((card) => ({
      ...card,
      summary: firstMeaning.get(card.id) ?? '',
    }));
  }

  async findCard(id: string): Promise<CardRow | null> {
    const row = await this.db
      .prepare('SELECT * FROM "Card" WHERE id = ?')
      .bind(id)
      .first<DatabaseCard>();
    return row ? { ...row, summary: '' } : null;
  }

  async listMeanings(cardId: string): Promise<MeaningRow[]> {
    const result = await this.db
      .prepare(
        'SELECT id, zhMeaning, enExample, zhExample FROM "CardMeaning" WHERE cardId = ? ORDER BY sortOrder ASC',
      )
      .bind(cardId)
      .all<MeaningRow>();
    return result.results;
  }
}
