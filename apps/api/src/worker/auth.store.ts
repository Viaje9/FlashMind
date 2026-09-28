import type { D1Database } from '@cloudflare/workers-types';
import type { AuthSession, AuthStore, AuthUser } from './auth.service';

export class D1AuthStore implements AuthStore {
  constructor(private readonly db: D1Database) {}

  findUserByEmail(email: string): Promise<AuthUser | null> {
    return this.db
      .prepare(
        'SELECT id, email, passwordHash, primaryProvider, timezone, createdAt, lastLoginAt FROM "User" WHERE email = ?',
      )
      .bind(email)
      .first<AuthUser>();
  }

  findUserById(id: string): Promise<AuthUser | null> {
    return this.db
      .prepare(
        'SELECT id, email, passwordHash, primaryProvider, timezone, createdAt, lastLoginAt FROM "User" WHERE id = ?',
      )
      .bind(id)
      .first<AuthUser>();
  }

  async insertUser(user: AuthUser & { updatedAt: string }): Promise<void> {
    await this.db
      .prepare(
        'INSERT INTO "User" (id, email, passwordHash, primaryProvider, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(
        user.id,
        user.email,
        user.passwordHash,
        user.primaryProvider,
        user.createdAt,
        user.updatedAt,
      )
      .run();
  }

  async updateLastLogin(userId: string, at: string): Promise<void> {
    await this.db
      .prepare('UPDATE "User" SET lastLoginAt = ?, updatedAt = ? WHERE id = ?')
      .bind(at, at, userId)
      .run();
  }

  async createSession(session: AuthSession): Promise<void> {
    await this.db
      .prepare(
        'INSERT INTO "Session" (id, userId, token, expiresAt, rememberMe, userAgent, ipAddress, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        session.id,
        session.userId,
        session.token,
        session.expiresAt,
        Number(session.rememberMe),
        session.userAgent ?? null,
        session.ipAddress ?? null,
        session.createdAt,
      )
      .run();
  }

  findSessionByToken(
    token: string,
  ): Promise<Pick<AuthSession, 'userId' | 'expiresAt'> | null> {
    return this.db
      .prepare('SELECT userId, expiresAt FROM "Session" WHERE token = ?')
      .bind(token)
      .first<Pick<AuthSession, 'userId' | 'expiresAt'>>();
  }

  async deleteSession(token: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM "Session" WHERE token = ?')
      .bind(token)
      .run();
  }
}
