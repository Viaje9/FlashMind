import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { WhitelistGuard } from '../auth/whitelist.guard';
import {
  CreateTopicConversationDto,
  CreateTopicConversationMessageDto,
  ListTopicConversationsDto,
} from './dto';
import { TopicConversationService } from './topic-conversation.service';

@Controller('topic-conversations')
@UseGuards(AuthGuard, WhitelistGuard)
export class TopicConversationController {
  constructor(private readonly service: TopicConversationService) {}

  @Get()
  listConversations(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListTopicConversationsDto,
  ) {
    return this.service.listConversations(req.user.id, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createConversation(
    @Req() req: AuthenticatedRequest,
    @Body() draft: CreateTopicConversationDto,
  ) {
    return this.service.createConversation(req.user.id, draft);
  }

  @Post('draft')
  createDraft(@Req() req: AuthenticatedRequest) {
    return this.service.createDraft(req.user.id);
  }

  @Post('draft/hint')
  createDraftHint(@Body() draft: CreateTopicConversationDto) {
    return this.service.createDraftHint(draft);
  }

  @Get(':id')
  getConversation(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.getConversation(req.user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteConversation(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.service.deleteConversation(req.user.id, id);
  }

  @Post(':id/messages')
  createMessage(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateTopicConversationMessageDto,
  ) {
    return this.service.createMessage(req.user.id, id, dto);
  }

  @Post(':id/messages/stream')
  async createMessageStream(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateTopicConversationMessageDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const result = await this.service.createMessageStream(
        req.user.id,
        id,
        dto,
        (delta) => sendEvent('assistant_delta', { delta }),
      );
      sendEvent('result', result);
      sendEvent('done', {});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 回覆失敗';
      sendEvent('error', { message });
    } finally {
      res.end();
    }
  }

  @Post(':id/hint')
  createHint(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.createHint(req.user.id, id);
  }

  @Post(':id/replay')
  @HttpCode(HttpStatus.CREATED)
  replayConversation(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.service.replayConversation(req.user.id, id);
  }
}
