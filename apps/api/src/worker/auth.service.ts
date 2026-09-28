import * as bcrypt from 'bcryptjs';
import { ApiError } from './errors';

export type AuthUser = {
  id: string;
  email: string;
  passwordHash: string | null;
  primaryProvider: 'EMAIL' | 'GOOGLE';
  timezone: string;
  createdAt: string;
  lastLoginAt: string | null;
};

export type AuthSession = {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  rememberMe: boolean;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: string;
};

export interface AuthStore {
  findUserByEmail(email: string): Promise<AuthUser | null>;
  findUserById(id: string): Promise<AuthUser | null>;
  insertUser(user: AuthUser & { updatedAt: string }): Promise<void>;
  updateLastLogin(userId: string, at: string): Promise<void>;
  createSession(session: AuthSession): Promise<void>;
  findSessionByToken(
    token: string,
  ): Promise<Pick<AuthSession, 'userId' | 'expiresAt'> | null>;
  deleteSession(token: string): Promise<void>;
}

export class AuthError extends ApiError {}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

function responseUser(user: AuthUser) {
  return {
    data: {
      id: user.id,
      email: user.email,
      primaryProvider: user.primaryProvider.toLowerCase(),
      createdAt: new Date(user.createdAt).toISOString(),
      lastLoginAt: user.lastLoginAt
        ? new Date(user.lastLoginAt).toISOString()
        : null,
    },
  };
}

export class AuthService {
  constructor(
    private readonly store: AuthStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async register(input: { email: string; password: string }) {
    const email = input.email.toLowerCase();
    if (await this.store.findUserByEmail(email)) {
      throw new AuthError(
        'AUTH_EMAIL_ALREADY_EXISTS',
        '此 Email 已被註冊',
        409,
      );
    }
    const at = this.now().toISOString();
    const user: AuthUser = {
      id: crypto.randomUUID(),
      email,
      passwordHash: await bcrypt.hash(input.password, 12),
      primaryProvider: 'EMAIL',
      timezone: 'Asia/Taipei',
      createdAt: at,
      lastLoginAt: null,
    };
    await this.store.insertUser({ ...user, updatedAt: at });
    const session = await this.issueSession(user.id);
    return { user: responseUser(user), ...session };
  }

  async login(input: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }) {
    const user = await this.store.findUserByEmail(input.email.toLowerCase());
    if (
      !user?.passwordHash ||
      !(await bcrypt.compare(input.password, user.passwordHash))
    ) {
      throw new AuthError('AUTH_INVALID_CREDENTIALS', 'Email 或密碼錯誤', 401);
    }
    await this.store.updateLastLogin(user.id, this.now().toISOString());
    const session = await this.issueSession(user.id, input.rememberMe === true);
    return { user: responseUser(user), ...session };
  }

  async currentUser(token: string | undefined) {
    return responseUser(await this.authenticate(token));
  }

  async authenticate(token: string | undefined): Promise<AuthUser> {
    if (!token) throw new AuthError('UNAUTHORIZED', '請先登入', 401);
    const session = await this.store.findSessionByToken(token);
    if (
      !session ||
      new Date(session.expiresAt).getTime() <= this.now().getTime()
    ) {
      throw new AuthError('UNAUTHORIZED', '請先登入', 401);
    }
    const user = await this.store.findUserById(session.userId);
    if (!user) throw new AuthError('UNAUTHORIZED', '請先登入', 401);
    return user;
  }

  async logout(token: string | undefined) {
    await this.currentUser(token);
    await this.store.deleteSession(token!);
  }

  private async issueSession(userId: string, rememberMe = false) {
    const now = this.now();
    const expiresAt = new Date(
      now.getTime() + (rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000,
    );
    const token = randomToken();
    await this.store.createSession({
      id: crypto.randomUUID(),
      userId,
      token,
      expiresAt: expiresAt.toISOString(),
      rememberMe,
      createdAt: now.toISOString(),
    });
    return { token, expiresAt };
  }
}
