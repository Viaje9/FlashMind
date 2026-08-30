import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  validateStructure,
  type CliAuthorizationCreate,
  type CliAuthorizationApprove,
  type CliAuthorizationExchange,
  type CliAuthorizationStarted,
  type CliAuthorizationStatus,
} from '@flashmind/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CliAuthService {
  private readonly limits = new Map<
    string,
    { count: number; expires: number }
  >();
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private check(name: Parameters<typeof validateStructure>[0], value: unknown) {
    const errors = validateStructure(name, value);
    if (errors.length)
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: '授權請求格式錯誤',
          details: errors,
        },
      });
  }
  private limit(key: string, max: number) {
    const now = Date.now();
    for (const [id, value] of this.limits)
      if (value.expires <= now) this.limits.delete(id);
    const current = this.limits.get(key) ?? { count: 0, expires: now + 60000 };
    if (current.count >= max || this.limits.size > 5000)
      throw new HttpException(
        {
          error: {
            code: 'RATE_LIMITED',
            message: '登入請求過於頻繁，請稍後再試',
          },
        },
        429,
      );
    current.count++;
    this.limits.set(key, current);
  }
  private frontendOrigin(): string {
    const value = this.config.get<string>('FRONTEND_URL');
    if (!value && this.config.get('NODE_ENV') === 'production')
      throw new ForbiddenException({
        error: {
          code: 'CLI_LOGIN_UNAVAILABLE',
          message: '尚未設定可信任的 App 登入來源',
        },
      });
    return new URL(value ?? 'http://localhost:4280').origin;
  }
  private secureEquals(a: string, b: string): boolean {
    const left = Buffer.from(a),
      right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  async create(
    input: CliAuthorizationCreate,
    ip: string,
  ): Promise<CliAuthorizationStarted> {
    this.limit(`create:${ip}`, 10);
    this.check('CliAuthorizationCreate', input);
    const origin = this.frontendOrigin();
    const record = await this.prisma.cliLoginAuthorization.create({
      data: {
        verifierHash: input.verifierHash,
        pairingCode: randomBytes(5).toString('hex').toUpperCase(),
        expiresAt: new Date(Date.now() + 5 * 60000),
      },
    });
    return {
      authorizationId: record.id,
      verificationUrl: `${origin}/cli-login?authorization=${encodeURIComponent(record.id)}`,
      pairingCode: record.pairingCode,
      expiresAt: record.expiresAt.toISOString(),
      pollIntervalMs: 1500,
    };
  }

  async approve(
    userId: string,
    id: string,
    input: CliAuthorizationApprove,
    origin?: string,
  ): Promise<CliAuthorizationStatus> {
    this.limit(`approve:${userId}`, 20);
    this.check('CliAuthorizationApprove', input);
    if (input.expectedUserId !== userId)
      throw new ForbiddenException({
        error: {
          code: 'ACCOUNT_CHANGED',
          message: '登入帳號已變更，請重新確認帳號',
        },
      });
    // JSON 自訂請求加上 Origin 白名單，拒絕缺少 Origin 的確認請求。
    if (origin !== this.frontendOrigin())
      throw new ForbiddenException({
        error: {
          code: 'CLI_ORIGIN_DENIED',
          message: '授權必須由可信任的 App 頁面確認',
        },
      });
    const record = await this.prisma.cliLoginAuthorization.findUnique({
      where: { id },
    });
    if (!record)
      throw new NotFoundException({
        error: { code: 'CLI_AUTH_NOT_FOUND', message: '找不到登入授權' },
      });
    if (record.expiresAt <= new Date())
      throw new GoneException({
        error: { code: 'CLI_AUTH_EXPIRED', message: '登入授權已過期' },
      });
    if (!this.secureEquals(record.pairingCode, input.pairingCode.toUpperCase()))
      throw new ForbiddenException({
        error: {
          code: 'CLI_PAIRING_MISMATCH',
          message: '配對碼不符，請核對終端機顯示的代碼',
        },
      });
    const updated = await this.prisma.cliLoginAuthorization.updateMany({
      where: {
        id,
        status: 'pending',
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        userId,
        status: input.decision === 'approve' ? 'approved' : 'denied',
      },
    });
    if (updated.count !== 1)
      throw new ConflictException({
        error: { code: 'CLI_AUTH_CONSUMED', message: '此授權已被處理' },
      });
    return {
      status: input.decision === 'approve' ? 'approved' : 'denied',
      expiresAt: record.expiresAt.toISOString(),
      userId,
      email: null,
    };
  }

  async exchange(
    id: string,
    input: CliAuthorizationExchange,
    ip: string,
  ): Promise<{
    data: CliAuthorizationStatus;
    session?: { token: string; expiresAt: Date };
  }> {
    this.limit(`exchange:${ip}`, 120);
    this.check('CliAuthorizationExchange', input);
    const record = await this.prisma.cliLoginAuthorization.findUnique({
      where: { id },
      include: { user: true },
    });
    const hash = createHash('sha256').update(input.verifier).digest('hex');
    if (!record || !this.secureEquals(record.verifierHash, hash))
      throw new NotFoundException({
        error: { code: 'CLI_AUTH_NOT_FOUND', message: '找不到有效的登入授權' },
      });
    if (record.expiresAt <= new Date())
      throw new GoneException({
        error: { code: 'CLI_AUTH_EXPIRED', message: '登入授權已過期' },
      });
    if (record.consumedAt)
      throw new ConflictException({
        error: { code: 'CLI_AUTH_CONSUMED', message: '授權已兌換，請重新登入' },
      });
    const data: CliAuthorizationStatus = {
      status: record.status as CliAuthorizationStatus['status'],
      expiresAt: record.expiresAt.toISOString(),
      userId: record.userId,
      email: record.user?.email ?? null,
    };
    if (record.status !== 'approved' || !record.userId) return { data };
    const session = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.cliLoginAuthorization.updateMany({
        where: {
          id,
          status: 'approved',
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date() },
      });
      if (updated.count !== 1)
        throw new ConflictException({
          error: {
            code: 'CLI_AUTH_CONSUMED',
            message: '授權已兌換或過期，請重新登入',
          },
        });
      return tx.session.create({
        data: {
          userId: record.userId!,
          token: randomBytes(32).toString('hex'),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60000),
          userAgent: 'FlashMind CLI',
        },
      });
    });
    return {
      data: { ...data, expiresAt: session.expiresAt.toISOString() },
      session: { token: session.token, expiresAt: session.expiresAt },
    };
  }
}
