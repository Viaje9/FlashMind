import type { D1Database } from '@cloudflare/workers-types';
import type {
  CardRow,
  CardStore,
  CardWrite,
  MeaningRow,
  MeaningWrite,
} from './card.service';

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

  async insertCard(card: CardWrite, meanings: MeaningWrite[]): Promise<void> {
    await this.db.batch([
      this.db
        .prepare(
          'INSERT INTO "Card" (id, deckId, front, note, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(
          card.id,
          card.deckId,
          card.front,
          card.note,
          card.createdAt,
          card.updatedAt,
        ),
      ...meanings.map((meaning) =>
        this.db
          .prepare(
            'INSERT INTO "CardMeaning" (id, cardId, zhMeaning, enExample, zhExample, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .bind(
            meaning.id,
            meaning.cardId,
            meaning.zhMeaning,
            meaning.enExample,
            meaning.zhExample,
            meaning.sortOrder,
            meaning.createdAt,
            meaning.updatedAt,
          ),
      ),
    ]);
  }

  async updateCard(
    id: string,
    deckId: string,
    card: Pick<CardWrite, 'front' | 'note' | 'updatedAt'>,
    meanings?: MeaningWrite[],
  ): Promise<void> {
    const statements = [
      this.db
        .prepare(
          'UPDATE "Card" SET front = ?, note = ?, updatedAt = ? WHERE id = ? AND deckId = ?',
        )
        .bind(card.front, card.note, card.updatedAt, id, deckId),
    ];
    if (meanings) {
      statements.push(
        this.db.prepare('DELETE FROM "CardMeaning" WHERE cardId = ?').bind(id),
      );
      statements.push(
        ...meanings.map((meaning) =>
          this.db
            .prepare(
              'INSERT INTO "CardMeaning" (id, cardId, zhMeaning, enExample, zhExample, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            )
            .bind(
              meaning.id,
              meaning.cardId,
              meaning.zhMeaning,
              meaning.enExample,
              meaning.zhExample,
              meaning.sortOrder,
              meaning.createdAt,
              meaning.updatedAt,
            ),
        ),
      );
    }
    await this.db.batch(statements);
  }

  async deleteCard(id: string): Promise<void> {
    await this.db.prepare('DELETE FROM "Card" WHERE id = ?').bind(id).run();
  }
}
