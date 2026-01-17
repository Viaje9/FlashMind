import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { randomBytes } from 'crypto';

const SESSION_DURATION_HOURS = 24;
const REMEMBER_ME_DURATION_DAYS = 30;

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(
    userId: string,
    options: {
      rememberMe?: boolean;
      userAgent?: string;
      ipAddress?: string;
    } = {},
  ) {
    const token = randomBytes(32).toString('hex');
    const { rememberMe = false, userAgent, ipAddress } = options;

    const expiresAt = rememberMe
      ? new Date(Date.now() + REMEMBER_ME_DURATION_DAYS * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

    const session = await this.prisma.session.create({
      data: {
        userId,
        token,
        rememberMe,
        expiresAt,
        userAgent,
        ipAddress,
      },
    });

    return session;
  }

  async validateSession(token: string) {
    const session = await this.prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session) {
      return null;
    }

    if (session.expiresAt < new Date()) {
      await this.revokeSession(token);
      return null;
    }

    return session;
  }

  async revokeSession(token: string) {
    try {
      await this.prisma.session.delete({
        where: { token },
      });
    } catch {
      // Session 不存在則忽略
    }
  }

  async revokeAllUserSessions(userId: string) {
    await this.prisma.session.deleteMany({
      where: { userId },
    });
  }

  async cleanExpiredSessions() {
    await this.prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
  }
}
