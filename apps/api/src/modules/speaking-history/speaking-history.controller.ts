import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type {
  SpeakingSessionCreate,
  SpeakingMessagesAppend,
  SpeakingReviewDraft,
  SpeakingHistoryMigration,
} from '@flashmind/shared';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { WhitelistGuard } from '../auth/whitelist.guard';
import { SpeakingHistoryService } from './speaking-history.service';

@Controller('speaking')
@UseGuards(AuthGuard, WhitelistGuard)
export class SpeakingHistoryController {
  constructor(private readonly service: SpeakingHistoryService) {}

  @Get('sessions')
  list(
    @Req() req: AuthenticatedRequest,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listSessions(req.user.id, {
      cursor,
      ...(limit ? { limit: Number(limit) } : {}),
    });
  }
  @Post('sessions')
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() body: SpeakingSessionCreate,
  ) {
    return { data: await this.service.createSession(req.user.id, body) };
  }
  @Get('sessions/:id')
  async detail(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return { data: await this.service.getSession(req.user.id, id) };
  }
  @Get('sessions/:id/messages')
  messages(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listMessages(req.user.id, id, {
      cursor,
      ...(limit ? { limit: Number(limit) } : {}),
    });
  }
  @Post('sessions/:id/messages')
  @HttpCode(200)
  async append(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: SpeakingMessagesAppend,
  ) {
    return { data: await this.service.appendMessages(req.user.id, id, body) };
  }
  @Delete('sessions/:id')
  @HttpCode(204)
  delete(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.deleteSession(req.user.id, id);
  }
  @Get('practice-context')
  async context(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return { data: await this.service.getPracticeContext(req.user.id) };
  }
  @Post('reviews/validate')
  @HttpCode(200)
  async validate(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return { data: await this.service.validateReview(req.user.id, body) };
  }
  @Post('reviews')
  async save(
    @Req() req: AuthenticatedRequest,
    @Body() body: SpeakingReviewDraft,
    @Res({ passthrough: true }) response: Response,
  ) {
    const data = await this.service.saveReview(req.user.id, body);
    response.status(data.status === 'alreadySaved' ? 200 : 201);
    response.setHeader('Cache-Control', 'no-store');
    return { data };
  }
  @Post('history-migrations')
  @HttpCode(200)
  async migrate(
    @Req() req: AuthenticatedRequest,
    @Body() body: SpeakingHistoryMigration,
  ) {
    return { data: await this.service.migrateHistory(req.user.id, body) };
  }
}
