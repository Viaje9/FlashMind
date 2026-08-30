import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type {
  CliAuthorizationApprove,
  CliAuthorizationCreate,
  CliAuthorizationExchange,
} from '@flashmind/shared';
import { AuthGuard, type AuthenticatedRequest } from './auth.guard';
import { WhitelistGuard } from './whitelist.guard';
import { CliAuthService } from './cli-auth.service';

@Controller('auth/cli/authorizations')
export class CliAuthController {
  constructor(private readonly service: CliAuthService) {}
  @Post()
  async create(
    @Body() body: CliAuthorizationCreate,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return { data: await this.service.create(body, req.ip ?? 'unknown') };
  }
  @Post(':id/approve')
  @HttpCode(200)
  @UseGuards(AuthGuard, WhitelistGuard)
  async approve(
    @Param('id') id: string,
    @Body() body: CliAuthorizationApprove,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return {
      data: await this.service.approve(
        req.user.id,
        id,
        body,
        req.get('origin'),
      ),
    };
  }
  @Post(':id/exchange')
  @HttpCode(200)
  async exchange(
    @Param('id') id: string,
    @Body() body: CliAuthorizationExchange,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    const result = await this.service.exchange(id, body, req.ip ?? 'unknown');
    if (result.session)
      res.cookie('session', result.session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        expires: result.session.expiresAt,
      });
    return { data: result.data };
  }
}
