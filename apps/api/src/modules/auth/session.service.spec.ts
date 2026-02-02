import { Test, TestingModule } from '@nestjs/testing';
import { SessionService } from './session.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SessionService', () => {
  let service: SessionService;
  let prisma: jest.Mocked<PrismaService>;

  const mockSession = {
    id: 'session-123',
    userId: 'user-123',
    token: 'mock-token-abc123',
    rememberMe: false,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    userAgent: 'Mozilla/5.0',
    ipAddress: '127.0.0.1',
    createdAt: new Date(),
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  };

  beforeEach(async () => {
    const mockPrismaService = {
      session: {
        create: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('應該建立 24 小時有效的 session', async () => {
      prisma.session.create.mockResolvedValue(mockSession);

      const result = await service.createSession('user-123', {
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
      });

      expect(prisma.session.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          token: expect.any(String),
          rememberMe: false,
          expiresAt: expect.any(Date),
          userAgent: 'Mozilla/5.0',
          ipAddress: '127.0.0.1',
        },
      });

      const createCall = prisma.session.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt as Date;
      const expectedExpiry = Date.now() + 24 * 60 * 60 * 1000;

      // 允許 5 秒誤差
      expect(expiresAt.getTime()).toBeGreaterThan(expectedExpiry - 5000);
      expect(expiresAt.getTime()).toBeLessThan(expectedExpiry + 5000);
      expect(result).toEqual(mockSession);
    });

    it('rememberMe 為 true 時應該建立 30 天有效的 session', async () => {
      prisma.session.create.mockResolvedValue({
        ...mockSession,
        rememberMe: true,
      });

      await service.createSession('user-123', { rememberMe: true });

      const createCall = prisma.session.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt as Date;
      const expectedExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;

      expect(createCall.data.rememberMe).toBe(true);
      // 允許 5 秒誤差
      expect(expiresAt.getTime()).toBeGreaterThan(expectedExpiry - 5000);
      expect(expiresAt.getTime()).toBeLessThan(expectedExpiry + 5000);
    });

    it('應該產生 64 字元的 hex token', async () => {
      prisma.session.create.mockResolvedValue(mockSession);

      await service.createSession('user-123');

      const createCall = prisma.session.create.mock.calls[0][0];
      const token = createCall.data.token as string;

      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('沒有 options 時應該使用預設值', async () => {
      prisma.session.create.mockResolvedValue(mockSession);

      await service.createSession('user-123');

      expect(prisma.session.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          token: expect.any(String),
          rememberMe: false,
          expiresAt: expect.any(Date),
          userAgent: undefined,
          ipAddress: undefined,
        },
      });
    });
  });

  describe('validateSession', () => {
    it('session 有效時應該回傳 session 與 user', async () => {
      prisma.session.findUnique.mockResolvedValue(mockSession);

      const result = await service.validateSession('mock-token-abc123');

      expect(prisma.session.findUnique).toHaveBeenCalledWith({
        where: { token: 'mock-token-abc123' },
        include: { user: true },
      });
      expect(result).toEqual(mockSession);
    });

    it('session 不存在時應該回傳 null', async () => {
      prisma.session.findUnique.mockResolvedValue(null);

      const result = await service.validateSession('nonexistent-token');

      expect(result).toBeNull();
    });

    it('session 已過期時應該撤銷並回傳 null', async () => {
      const expiredSession = {
        ...mockSession,
        expiresAt: new Date(Date.now() - 1000), // 1 秒前過期
      };
      prisma.session.findUnique.mockResolvedValue(expiredSession);
      prisma.session.delete.mockResolvedValue(expiredSession);

      const result = await service.validateSession('expired-token');

      expect(prisma.session.delete).toHaveBeenCalledWith({
        where: { token: 'expired-token' },
      });
      expect(result).toBeNull();
    });
  });

  describe('revokeSession', () => {
    it('應該刪除指定的 session', async () => {
      prisma.session.delete.mockResolvedValue(mockSession);

      await service.revokeSession('mock-token-abc123');

      expect(prisma.session.delete).toHaveBeenCalledWith({
        where: { token: 'mock-token-abc123' },
      });
    });

    it('session 不存在時不應該拋出錯誤', async () => {
      prisma.session.delete.mockRejectedValue(new Error('Record not found'));

      await expect(
        service.revokeSession('nonexistent-token'),
      ).resolves.not.toThrow();
    });
  });

  describe('revokeAllUserSessions', () => {
    it('應該刪除該使用者所有 session', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 3 });

      await service.revokeAllUserSessions('user-123');

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });
  });

  describe('cleanExpiredSessions', () => {
    it('應該刪除所有過期的 session', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 5 });

      await service.cleanExpiredSessions();

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
        },
      });
    });
  });
});
