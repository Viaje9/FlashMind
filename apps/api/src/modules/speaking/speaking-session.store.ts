import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SpeakingChatHistoryItemDto } from './dto';

const DEFAULT_SESSION_TTL_SECONDS = 30 * 60;

export const SPEAKING_SESSION_STORE = Symbol('SPEAKING_SESSION_STORE');

export interface SpeakingSession {
  userId: string;
  conversationId: string;
  history: SpeakingChatHistoryItemDto[];
  expiresAt: number;
}

export type SpeakingSessionLookupResult =
  | {
      status: 'found';
      session: SpeakingSession;
    }
  | {
      status: 'missing';
    }
  | {
      status: 'expired';
    }
  | {
      status: 'forbidden';
    };

export interface SpeakingSessionStore {
  getSession(
    userId: string,
    conversationId: string,
  ): SpeakingSessionLookupResult;
  saveSession(input: {
    userId: string;
    conversationId: string;
    history: SpeakingChatHistoryItemDto[];
  }): SpeakingSession;
  clearSession(userId: string, conversationId: string): void;
}

interface StoredSpeakingSession {
  userId: string;
  conversationId: string;
  history: SpeakingChatHistoryItemDto[];
  expiresAt: number;
}

@Injectable()
export class InMemorySpeakingSessionStore implements SpeakingSessionStore {
  private readonly sessions = new Map<string, StoredSpeakingSession>();
  private readonly conversationOwnerKeys = new Map<string, string>();
  private readonly sessionTtlMs: number;

  constructor(private readonly configService: ConfigService) {
    this.sessionTtlMs =
      this.parsePositiveInt(
        this.configService.get<string>('OPENAI_SPEAKING_SESSION_TTL_SECONDS'),
      ) * 1000;
  }

  getSession(
    userId: string,
    conversationId: string,
  ): SpeakingSessionLookupResult {
    const normalizedUserId = userId.trim();
    const normalizedConversationId = conversationId.trim();
    const now = Date.now();
    if (!normalizedUserId || !normalizedConversationId) {
      return { status: 'missing' };
    }

    const ownerKey = this.conversationOwnerKeys.get(normalizedConversationId);
    if (!ownerKey) {
      this.pruneExpiredSessions(now);
      return { status: 'missing' };
    }

    const expectedKey = this.createCompositeKey(
      normalizedUserId,
      normalizedConversationId,
    );
    if (ownerKey !== expectedKey) {
      return { status: 'forbidden' };
    }

    const session = this.sessions.get(ownerKey);
    if (!session) {
      this.conversationOwnerKeys.delete(normalizedConversationId);
      this.pruneExpiredSessions(now);
      return { status: 'missing' };
    }

    if (session.expiresAt <= now) {
      this.deleteSessionByKey(ownerKey);
      this.pruneExpiredSessions(now);
      return { status: 'expired' };
    }

    this.pruneExpiredSessions(now);
    return {
      status: 'found',
      session: this.cloneSession(session),
    };
  }

  saveSession(input: {
    userId: string;
    conversationId: string;
    history: SpeakingChatHistoryItemDto[];
  }): SpeakingSession {
    const userId = input.userId.trim();
    const conversationId = input.conversationId.trim();
    const key = this.createCompositeKey(userId, conversationId);
    const now = Date.now();

    this.pruneExpiredSessions(now);

    const session: StoredSpeakingSession = {
      userId,
      conversationId,
      history: this.cloneHistory(input.history),
      expiresAt: now + this.sessionTtlMs,
    };

    this.sessions.set(key, session);
    this.conversationOwnerKeys.set(conversationId, key);

    return this.cloneSession(session);
  }

  clearSession(userId: string, conversationId: string): void {
    const key = this.createCompositeKey(userId.trim(), conversationId.trim());
    this.deleteSessionByKey(key);
  }

  private parsePositiveInt(rawValue: string | undefined): number {
    const parsed = Number.parseInt(rawValue ?? '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_SESSION_TTL_SECONDS;
    }
    return parsed;
  }

  private createCompositeKey(userId: string, conversationId: string): string {
    return `${userId}:${conversationId}`;
  }

  private pruneExpiredSessions(now: number): void {
    for (const [key, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        this.deleteSessionByKey(key);
      }
    }
  }

  private deleteSessionByKey(key: string): void {
    const session = this.sessions.get(key);
    if (!session) {
      return;
    }

    this.sessions.delete(key);
    if (this.conversationOwnerKeys.get(session.conversationId) === key) {
      this.conversationOwnerKeys.delete(session.conversationId);
    }
  }

  private cloneSession(session: StoredSpeakingSession): SpeakingSession {
    return {
      userId: session.userId,
      conversationId: session.conversationId,
      history: this.cloneHistory(session.history),
      expiresAt: session.expiresAt,
    };
  }

  private cloneHistory(
    history: SpeakingChatHistoryItemDto[],
  ): SpeakingChatHistoryItemDto[] {
    return history.map((item) => ({
      role: item.role,
      text: item.text,
      audioBase64: item.audioBase64,
    }));
  }
}
