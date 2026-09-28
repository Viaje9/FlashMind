import type { D1Database } from '@cloudflare/workers-types';
import type {
  DeckCounts,
  DeckDetailRow,
  DeckRow,
  DeckStore,
} from './deck.service';

type D1DeckRow = Omit<DeckRow, 'enableReverse'> & { enableReverse: number };
type CardCounts = Pick<
  DeckCounts,
  | 'totalCount'
  | 'newCount'
  | 'reviewCount'
  | 'reverseNewCount'
  | 'reverseReviewCount'
>;
type ReviewCounts = Pick<DeckCounts, 'todayNewStudied' | 'todayReviewStudied'>;

export class D1DeckStore implements DeckStore {
  constructor(private readonly db: D1Database) {}

  async listByUser(userId: string): Promise<DeckRow[]> {
    const result = await this.db
      .prepare(
        'SELECT id, name, userId, dailyNewCards, dailyReviewCards, dailyResetHour, enableReverse, overrideDate, overrideNewCards, overrideReviewCards FROM "Deck" WHERE userId = ? ORDER BY updatedAt DESC',
      )
      .bind(userId)
      .all<D1DeckRow>();
    return result.results.map((row) => ({
      ...row,
      enableReverse: row.enableReverse === 1,
    }));
  }

  async findById(id: string): Promise<DeckDetailRow | null> {
    const row = await this.db
      .prepare('SELECT * FROM "Deck" WHERE id = ?')
      .bind(id)
      .first<
        Omit<DeckDetailRow, 'enableReverse'> & { enableReverse: number }
      >();
    return row ? { ...row, enableReverse: row.enableReverse === 1 } : null;
  }

  async lastStudiedAt(deckId: string): Promise<string | null> {
    const row = await this.db
      .prepare(
        'SELECT r.reviewedAt FROM "ReviewLog" r JOIN "Card" c ON c.id = r.cardId WHERE c.deckId = ? ORDER BY r.reviewedAt DESC LIMIT 1',
      )
      .bind(deckId)
      .first<{ reviewedAt: string }>();
    return row?.reviewedAt ?? null;
  }

  async insertDeck(deck: DeckDetailRow): Promise<void> {
    await this.db
      .prepare(
        'INSERT INTO "Deck" (id, userId, name, dailyNewCards, dailyReviewCards, dailyResetHour, learningSteps, relearningSteps, requestRetention, maximumInterval, enableReverse, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        deck.id,
        deck.userId,
        deck.name,
        deck.dailyNewCards,
        deck.dailyReviewCards,
        deck.dailyResetHour,
        deck.learningSteps,
        deck.relearningSteps,
        deck.requestRetention,
        deck.maximumInterval,
        Number(deck.enableReverse),
        deck.createdAt,
        deck.updatedAt,
      )
      .run();
  }

  async countsForDeck(
    deckId: string,
    studyDayStart: string,
    now: string,
  ): Promise<DeckCounts> {
    const [cards, reviews] = await this.db.batch([
      this.db
        .prepare(
          `SELECT COUNT(*) AS totalCount,
            COALESCE(SUM(CASE WHEN state = 'NEW' THEN 1 ELSE 0 END), 0) AS newCount,
            COALESCE(SUM(CASE WHEN state <> 'NEW' AND due <= ? THEN 1 ELSE 0 END), 0) AS reviewCount,
            COALESCE(SUM(CASE WHEN reverseState = 'NEW' THEN 1 ELSE 0 END), 0) AS reverseNewCount,
            COALESCE(SUM(CASE WHEN reverseState <> 'NEW' AND reverseDue <= ? THEN 1 ELSE 0 END), 0) AS reverseReviewCount
            FROM "Card" WHERE deckId = ?`,
        )
        .bind(now, now, deckId),
      this.db
        .prepare(
          `SELECT
            COALESCE(SUM(CASE WHEN r.prevState = 'NEW' THEN 1 ELSE 0 END), 0) AS todayNewStudied,
            COALESCE(SUM(CASE WHEN r.prevState <> 'NEW' THEN 1 ELSE 0 END), 0) AS todayReviewStudied
            FROM "ReviewLog" r JOIN "Card" c ON c.id = r.cardId
            WHERE c.deckId = ? AND r.reviewedAt >= ?`,
        )
        .bind(deckId, studyDayStart),
    ]);
    return {
      ...(cards.results[0] as CardCounts),
      ...(reviews.results[0] as ReviewCounts),
    };
  }
}
