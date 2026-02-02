import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { SessionService } from './session.service';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let sessionService: jest.Mocked<SessionService>;

  const mockSession = {
    id: 'session-123',
    userId: 'user-123',
    token: 'valid-session-token',
    rememberMe: false,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    userAgent: 'Mozilla/5.0',
    ipAddress: '127.0.0.1',
    createdAt: new Date(),
    user: {
      id: 'user-123',
      email: 'test@example.com',
      timezone: 'Asia/Taipei',
    },
  };

  const createMockExecutionContext = (
    cookies: Record<string, string> = {},
  ): ExecutionContext => {
    const mockRequest = {
      cookies,
      user: undefined as { id: string; email: string } | undefined,
      sessionToken: undefined as string | undefined,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    const mockSessionService = {
      validateSession: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: SessionService, useValue: mockSessionService },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    sessionService = module.get(SessionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('有效 session 時應該回傳 true 並設定 user 資訊', async () => {
      const context = createMockExecutionContext({
        session: 'valid-session-token',
      });
      sessionService.validateSession.mockResolvedValue(mockSession);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(sessionService.validateSession).toHaveBeenCalledWith(
        'valid-session-token',
      );

      const request = context.switchToHttp().getRequest();
      expect(request.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        timezone: 'Asia/Taipei',
      });
      expect(request.sessionToken).toBe('valid-session-token');
    });

    it('沒有 session cookie 時應該拋出 UnauthorizedException', async () => {
      const context = createMockExecutionContext({});

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: {
          error: {
            code: 'UNAUTHORIZED',
            message: '請先登入',
          },
        },
      });
    });

    it('session 驗證失敗時應該拋出 UnauthorizedException', async () => {
      const context = createMockExecutionContext({ session: 'invalid-token' });
      sessionService.validateSession.mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: {
          error: {
            code: 'UNAUTHORIZED',
            message: '請先登入',
          },
        },
      });
    });

    it('cookies 為 undefined 時應該拋出 UnauthorizedException', async () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            cookies: undefined,
          }),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('session cookie 為空字串時應該拋出 UnauthorizedException', async () => {
      const context = createMockExecutionContext({ session: '' });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(sessionService.validateSession).not.toHaveBeenCalled();
    });
  });
});
