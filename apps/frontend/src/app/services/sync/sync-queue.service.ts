import { Injectable } from '@angular/core';
import { Observable, Subject, from } from 'rxjs';
import { flashmindDb, ReviewQueueEntry, SyncJournalEntry } from '../../data/flashmind-db';

export type SyncQueueEvent =
  | { type: 'enqueue'; entryId: string }
  | { type: 'replay'; batchId: string; entries: ReviewQueueEntry[] }
  | { type: 'synced'; entryIds: string[] }
  | { type: 'failed'; entryIds: string[]; reason: unknown };

const STORAGE_KEY = 'flashmind:sync-queue';

@Injectable({ providedIn: 'root' })
export class SyncQueueService {
  private readonly events$ = new Subject<SyncQueueEvent>();

  get events(): Observable<SyncQueueEvent> {
    return this.events$.asObservable();
  }

  enqueue(entry: Omit<ReviewQueueEntry, 'id' | 'payloadVersion'>): Observable<string> {
    const id = this.generateId();
    const record: ReviewQueueEntry = {
      payloadVersion: 1,
      ...entry,
      id,
    };

    const operation = flashmindDb.reviewQueue.add(record).then(() => {
      this.pushToStorage(id);
      this.events$.next({ type: 'enqueue', entryId: id });
      return id;
    });

    return from(operation);
  }

  listPending(): Observable<ReviewQueueEntry[]> {
    return from(flashmindDb.reviewQueue.toArray());
  }

  markSynced(entryIds: string[]): Observable<void> {
    const operation = flashmindDb.transaction('rw', flashmindDb.reviewQueue, flashmindDb.syncJournal, async () => {
      await flashmindDb.reviewQueue.bulkDelete(entryIds);
      this.removeFromStorage(entryIds);
      this.events$.next({ type: 'synced', entryIds });
    });
    return from(operation);
  }

  recordReplay(batchId: string, entries: ReviewQueueEntry[]): Observable<string> {
    const journal: SyncJournalEntry = {
      id: this.generateId(),
      batchId,
      deviceId: entries[0]?.deviceId ?? '',
      userId: undefined,
      submittedAt: new Date().toISOString(),
      status: 'pending',
      retryCount: 0,
    };

    const operation = flashmindDb.syncJournal.add(journal).then(() => {
      this.events$.next({ type: 'replay', batchId, entries });
      return journal.id;
    });

    return from(operation);
  }

  updateReplayStatus(journalId: string, status: SyncJournalEntry['status'], responseAt = new Date()): Observable<void> {
    const operation = flashmindDb.syncJournal.update(journalId, {
      status,
      responseAt: responseAt.toISOString(),
    });

    return from(operation.then(() => undefined));
  }

  failEntries(entryIds: string[], reason: unknown): Observable<void> {
    const operation = flashmindDb.transaction('rw', flashmindDb.reviewQueue, async () => {
      for (const id of entryIds) {
        await flashmindDb.reviewQueue.update(id, { syncedAt: undefined });
      }
      this.events$.next({ type: 'failed', entryIds, reason });
    });

    return from(operation);
  }

  private pushToStorage(entryId: string): void {
    const ids = this.readStorage();
    ids.push(entryId);
    this.writeStorage(ids);
  }

  private removeFromStorage(entryIds: string[]): void {
    const ids = this.readStorage().filter((id) => !entryIds.includes(id));
    this.writeStorage(ids);
  }

  private readStorage(): string[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  private writeStorage(ids: string[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
