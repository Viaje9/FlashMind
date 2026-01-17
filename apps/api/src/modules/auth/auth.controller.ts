import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Res,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { RegisterDto, LoginDto } from './dto';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.guard';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const userResponse = await this.authService.register(dto);

    const session = await this.sessionService.createSession(
      userResponse.data.id,
      {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      },
    );

    res.cookie('session', session.token, {
      ...COOKIE_OPTIONS,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    return userResponse;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const userResponse = await this.authService.login(dto);

    const session = await this.sessionService.createSession(
      userResponse.data.id,
      {
        rememberMe: dto.rememberMe,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      },
    );

    const maxAge = dto.rememberMe
      ? 30 * 24 * 60 * 60 * 1000 // 30 days
      : 24 * 60 * 60 * 1000; // 24 hours

    res.cookie('session', session.token, {
      ...COOKIE_OPTIONS,
      maxAge,
    });

    return userResponse;
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.sessionService.revokeSession(req.sessionToken);

    res.cookie('session', '', {
      ...COOKIE_OPTIONS,
      maxAge: 0,
    });
  }

  @Get('google')
  @HttpCode(HttpStatus.FOUND)
  initiateGoogleOAuth(
    @Query('rememberMe') rememberMe: string,
    @Res() res: Response,
  ) {
    const shouldRemember = rememberMe === 'true';
    const authUrl = this.authService.getGoogleAuthUrl(shouldRemember);
    res.redirect(authUrl);
  }

  @Get('google/callback')
  async handleGoogleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:4280';

    // 處理 Google OAuth 錯誤（例如使用者取消授權）
    if (error) {
      res.redirect(`${frontendUrl}/welcome?error=${encodeURIComponent(error)}`);
      return;
    }

    const { user, rememberMe } = await this.authService.handleGoogleCallback(
      code,
      state,
    );

    const session = await this.sessionService.createSession(user.id, {
      rememberMe,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    const maxAge = rememberMe
      ? 30 * 24 * 60 * 60 * 1000 // 30 days
      : 24 * 60 * 60 * 1000; // 24 hours

    res.cookie('session', session.token, {
      ...COOKIE_OPTIONS,
      maxAge,
    });

    res.redirect(frontendUrl);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getCurrentUser(@Req() req: AuthenticatedRequest) {
    return this.authService.getUserById(req.user.id);
  }
}
