import Dexie, { Table } from 'dexie';

export type ReviewRating = 'again' | 'hard' | 'easy';

export interface DeckRecord {
  id: string;
  ownerUserId?: string;
  ownerDeviceId?: string;
  name: string;
  slug: string;
  dailyNewLimit: number;
  reviewOrder: 'due_first' | 'new_first' | 'mixed';
  version: number;
  updatedAt: string;
  localOnly?: boolean;
}

export interface CardSense {
  meaning: string;
  exampleEn?: string;
  exampleZh?: string;
  source: 'ai' | 'manual';
  confidence?: number;
  revisions?: unknown[];
}

export interface CardRecord {
  id: string;
  deckId: string;
  term: string;
  notes?: string;
  senses: CardSense[];
  tags: string[];
  version: number;
  authority: 'local' | 'server';
  stability: number;
  difficulty: number;
  due: string;
  lastReviewedAt?: string;
  reviewCount: number;
  lastRating?: ReviewRating;
  localRevision?: number;
}

export interface ReviewQueueEntry {
  id: string;
  cardId: string;
  deckId: string;
  deviceId: string;
  rating: ReviewRating;
  reviewedAt: string;
  sessionId: string;
  sequence: number;
  payloadVersion: number;
  syncedAt?: string;
}

export interface SyncJournalEntry {
  id: string;
  deviceId: string;
  userId?: string;
  batchId: string;
  submittedAt: string;
  responseAt?: string;
  status: 'pending' | 'synced' | 'conflicted' | 'failed';
  retryCount: number;
}

export class FlashmindDb extends Dexie {
  decks!: Table<DeckRecord, string>;
  cards!: Table<CardRecord, string>;
  reviewQueue!: Table<ReviewQueueEntry, string>;
  syncJournal!: Table<SyncJournalEntry, string>;

  constructor() {
    super('flashmind-db');

    this.version(1).stores({
      decks: '&id, ownerUserId, ownerDeviceId, [ownerUserId+slug], [ownerDeviceId+slug], updatedAt',
      cards: '&id, deckId, term, due, authority',
      reviewQueue: '&id, deckId, cardId, [deviceId+sessionId+sequence], syncedAt',
      syncJournal: '&id, batchId, status, submittedAt',
    });
  }
}

export const flashmindDb = new FlashmindDb();
