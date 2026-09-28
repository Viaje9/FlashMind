import * as bcrypt from 'bcryptjs';
import { AuthService, type AuthStore, type AuthUser } from './auth.service';

const now = new Date('2026-09-28T00:00:00.000Z');

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: null,
    primaryProvider: 'EMAIL',
    createdAt: '2026-09-01T00:00:00.000Z',
    lastLoginAt: null,
    ...overrides,
  };
}

function store(): jest.Mocked<AuthStore> {
  return {
    findUserByEmail: jest.fn().mockResolvedValue(null),
    findUserById: jest.fn().mockResolvedValue(null),
    insertUser: jest.fn(),
    updateLastLogin: jest.fn().mockResolvedValue(undefined),
    createSession: jest.fn().mockResolvedValue(undefined),
    findSessionByToken: jest.fn().mockResolvedValue(null),
    deleteSession: jest.fn().mockResolvedValue(undefined),
  };
}

describe('Worker AuthService', () => {
  it('沿用 PostgreSQL 備份中的 bcrypt 密碼雜湊登入並建立 30 天 session', async () => {
    const repository = store();
    repository.findUserByEmail.mockResolvedValue(
      user({ passwordHash: await bcrypt.hash('correct-password', 4) }),
    );
    const service = new AuthService(repository, () => now);

    const result = await service.login({
      email: 'TEST@example.com',
      password: 'correct-password',
      rememberMe: true,
    });

    expect(result.user.data.email).toBe('test@example.com');
    expect(repository.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        expiresAt: '2026-10-28T00:00:00.000Z',
        rememberMe: true,
      }),
    );
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('密碼錯誤時不建立 session', async () => {
    const repository = store();
    repository.findUserByEmail.mockResolvedValue(
      user({ passwordHash: await bcrypt.hash('correct-password', 4) }),
    );
    const service = new AuthService(repository, () => now);

    await expect(
      service.login({ email: 'test@example.com', password: 'wrong-password' }),
    ).rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS', status: 401 });
    expect(repository.createSession).not.toHaveBeenCalled();
  });

  it('過期 session 不可讀取使用者', async () => {
    const repository = store();
    repository.findSessionByToken.mockResolvedValue({
      userId: 'user-1',
      expiresAt: '2026-09-27T23:59:59.000Z',
    });
    const service = new AuthService(repository, () => now);

    await expect(service.currentUser('expired')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      status: 401,
    });
  });

  it('重複 Email 不建立帳號', async () => {
    const repository = store();
    repository.findUserByEmail.mockResolvedValue(user());
    const service = new AuthService(repository, () => now);

    await expect(
      service.register({ email: 'TEST@example.com', password: 'password123' }),
    ).rejects.toMatchObject({ code: 'AUTH_EMAIL_ALREADY_EXISTS', status: 409 });
    expect(repository.insertUser).not.toHaveBeenCalled();
  });
});
