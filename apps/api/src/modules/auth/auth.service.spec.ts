import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Provider } from '@prisma/client';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    primaryProvider: Provider.EMAIL,
    createdAt: new Date('2024-01-01'),
    lastLoginAt: new Date('2024-01-02'),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      oAuthAccount: {
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockSessionService = {
      createSession: jest.fn(),
      validateSession: jest.fn(),
      revokeSession: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SessionService, useValue: mockSessionService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = { email: 'Test@Example.com', password: 'password123' };

    it('應該成功註冊新使用者', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue(mockUser);

      const result = await service.register(registerDto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          passwordHash: 'hashed-password',
          primaryProvider: Provider.EMAIL,
        },
      });
      expect(result.data).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        primaryProvider: 'email',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastLoginAt: '2024-01-02T00:00:00.000Z',
      });
    });

    it('應該將 email 轉為小寫', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue(mockUser);

      await service.register({
        email: 'TEST@EXAMPLE.COM',
        password: 'password123',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('Email 已存在時應該拋出 ConflictException', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.register(registerDto)).rejects.toMatchObject({
        response: {
          error: {
            code: 'AUTH_EMAIL_ALREADY_EXISTS',
            message: '此 Email 已被註冊',
          },
        },
      });
    });
  });

  describe('login', () => {
    const loginDto = { email: 'test@example.com', password: 'password123' };

    it('應該成功登入並更新 lastLoginAt', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        lastLoginAt: new Date(),
      });

      const result = await service.login(loginDto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'password123',
        'hashed-password',
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { lastLoginAt: expect.any(Date) },
      });
      expect(result.data.id).toBe('user-123');
    });

    it('使用者不存在時應該拋出 UnauthorizedException', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toMatchObject({
        response: {
          error: {
            code: 'AUTH_INVALID_CREDENTIALS',
            message: 'Email 或密碼錯誤',
          },
        },
      });
    });

    it('使用者無密碼（OAuth 使用者）時應該拋出 UnauthorizedException', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordHash: null,
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('密碼錯誤時應該拋出 UnauthorizedException', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toMatchObject({
        response: {
          error: {
            code: 'AUTH_INVALID_CREDENTIALS',
            message: 'Email 或密碼錯誤',
          },
        },
      });
    });
  });

  describe('getUserById', () => {
    it('應該回傳使用者資訊', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getUserById('user-123');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
      expect(result.data.id).toBe('user-123');
      expect(result.data.email).toBe('test@example.com');
    });

    it('使用者不存在時應該拋出 UnauthorizedException', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserById('nonexistent')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.getUserById('nonexistent')).rejects.toMatchObject({
        response: {
          error: {
            code: 'UNAUTHORIZED',
            message: '請先登入',
          },
        },
      });
    });

    it('lastLoginAt 為 null 時應該回傳 null', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        lastLoginAt: null,
      });

      const result = await service.getUserById('user-123');

      expect(result.data.lastLoginAt).toBeNull();
    });
  });

  describe('getGoogleAuthUrl', () => {
    beforeEach(() => {
      configService.get.mockImplementation((key: string) => {
        const config: Record<string, string> = {
          GOOGLE_CLIENT_ID: 'test-client-id',
          GOOGLE_CALLBACK_URL: 'http://localhost:3000/auth/google/callback',
        };
        return config[key];
      });
    });

    it('應該產生正確的 Google OAuth URL', () => {
      const url = service.getGoogleAuthUrl(false);

      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain(
        'redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fgoogle%2Fcallback',
      );
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=openid%20email%20profile');
    });

    it('應該在 state 中包含 rememberMe 資訊', () => {
      const urlWithRemember = service.getGoogleAuthUrl(true);
      const urlWithoutRemember = service.getGoogleAuthUrl(false);

      const stateWithRemember = new URL(urlWithRemember).searchParams.get(
        'state',
      );
      const stateWithoutRemember = new URL(urlWithoutRemember).searchParams.get(
        'state',
      );

      const decodedWithRemember = JSON.parse(
        Buffer.from(stateWithRemember!, 'base64url').toString(),
      );
      const decodedWithoutRemember = JSON.parse(
        Buffer.from(stateWithoutRemember!, 'base64url').toString(),
      );

      expect(decodedWithRemember.rememberMe).toBe(true);
      expect(decodedWithoutRemember.rememberMe).toBe(false);
    });

    it('缺少 GOOGLE_CLIENT_ID 時應該拋出 BadRequestException', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'GOOGLE_CLIENT_ID') return undefined;
        return 'http://localhost:3000/auth/google/callback';
      });

      expect(() => service.getGoogleAuthUrl(false)).toThrow(
        BadRequestException,
      );
      expect(() => service.getGoogleAuthUrl(false)).toThrow(
        expect.objectContaining({
          response: {
            error: {
              code: 'CONFIG_ERROR',
              message: 'Google OAuth 尚未設定',
            },
          },
        }),
      );
    });

    it('缺少 GOOGLE_CALLBACK_URL 時應該拋出 BadRequestException', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'GOOGLE_CALLBACK_URL') return undefined;
        return 'test-client-id';
      });

      expect(() => service.getGoogleAuthUrl(false)).toThrow(
        BadRequestException,
      );
    });
  });
});
