import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionService } from './session.service';
import { RegisterDto, LoginDto } from './dto';
import * as bcrypt from 'bcrypt';
import { Provider } from '@prisma/client';

const BCRYPT_COST = 12;

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException({
        error: {
          code: 'AUTH_EMAIL_ALREADY_EXISTS',
          message: '此 Email 已被註冊',
        },
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        primaryProvider: Provider.EMAIL,
      },
    });

    return this.formatUserResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException({
        error: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Email 或密碼錯誤',
        },
      });
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException({
        error: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Email 或密碼錯誤',
        },
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.formatUserResponse(user);
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException({
        error: {
          code: 'UNAUTHORIZED',
          message: '請先登入',
        },
      });
    }

    return this.formatUserResponse(user);
  }

  getGoogleAuthUrl(rememberMe: boolean = false) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const callbackUrl = this.configService.get<string>('GOOGLE_CALLBACK_URL');

    if (!clientId || !callbackUrl) {
      throw new BadRequestException({
        error: {
          code: 'CONFIG_ERROR',
          message: 'Google OAuth 尚未設定',
        },
      });
    }

    const state = Buffer.from(JSON.stringify({ rememberMe })).toString('base64url');
    const scope = encodeURIComponent('openid email profile');

    return (
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&state=${state}` +
      `&access_type=offline` +
      `&prompt=consent`
    );
  }

  async handleGoogleCallback(code: string, state?: string) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackUrl = this.configService.get<string>('GOOGLE_CALLBACK_URL');

    if (!clientId || !clientSecret || !callbackUrl) {
      throw new BadRequestException({
        error: {
          code: 'CONFIG_ERROR',
          message: 'Google OAuth 尚未設定',
        },
      });
    }

    // 交換 token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      throw new UnauthorizedException({
        error: {
          code: 'AUTH_GOOGLE_FAILED',
          message: 'Google 登入失敗，請重試',
        },
      });
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();

    // 取得使用者資訊
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      throw new UnauthorizedException({
        error: {
          code: 'AUTH_GOOGLE_FAILED',
          message: 'Google 登入失敗，請重試',
        },
      });
    }

    const googleUser: GoogleUserInfo = await userInfoResponse.json();

    // 解析 state
    let rememberMe = false;
    if (state) {
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
        rememberMe = stateData.rememberMe === true;
      } catch {
        // 忽略解析錯誤
      }
    }

    // 查找或建立使用者
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: googleUser.email.toLowerCase() },
          {
            oauthAccounts: {
              some: {
                provider: Provider.GOOGLE,
                providerId: googleUser.sub,
              },
            },
          },
        ],
      },
      include: { oauthAccounts: true },
    });

    if (user) {
      // 更新 OAuth account
      const existingOAuth = user.oauthAccounts.find(
        (a) => a.provider === Provider.GOOGLE && a.providerId === googleUser.sub,
      );

      if (!existingOAuth) {
        await this.prisma.oAuthAccount.create({
          data: {
            userId: user.id,
            provider: Provider.GOOGLE,
            providerId: googleUser.sub,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          },
        });
      } else {
        await this.prisma.oAuthAccount.update({
          where: { id: existingOAuth.id },
          data: {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token ?? existingOAuth.refreshToken,
            expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          },
        });
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    } else {
      // 建立新使用者
      user = await this.prisma.user.create({
        data: {
          email: googleUser.email.toLowerCase(),
          primaryProvider: Provider.GOOGLE,
          lastLoginAt: new Date(),
          oauthAccounts: {
            create: {
              provider: Provider.GOOGLE,
              providerId: googleUser.sub,
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            },
          },
        },
        include: { oauthAccounts: true },
      });
    }

    return { user, rememberMe };
  }

  private formatUserResponse(user: {
    id: string;
    email: string;
    primaryProvider: Provider;
    createdAt: Date;
    lastLoginAt: Date | null;
  }) {
    return {
      data: {
        id: user.id,
        email: user.email,
        primaryProvider: user.primaryProvider.toLowerCase(),
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      },
    };
  }
}
