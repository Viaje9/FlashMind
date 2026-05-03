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
  UseGuards,
} from '@nestjs/common';

import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { WhitelistGuard } from '../auth/whitelist.guard';
import { CollectionService } from './collection.service';
import {
  CreateCollectionChatMessageDto,
  CreateCollectionItemDto,
  ListCollectionItemsDto,
} from './dto';

@Controller('collections')
@UseGuards(AuthGuard, WhitelistGuard)
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Get()
  async listItems(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListCollectionItemsDto,
  ) {
    return this.collectionService.listItems(req.user.id, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createItem(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCollectionItemDto,
  ) {
    return this.collectionService.createItem(req.user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteItem(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.collectionService.deleteItem(req.user.id, id);
  }

  @Post('chat-sessions')
  @HttpCode(HttpStatus.CREATED)
  async createChatSession(@Req() req: AuthenticatedRequest) {
    return this.collectionService.createChatSession(req.user.id);
  }

  @Get('chat-sessions/:sessionId/messages')
  async listChatMessages(
    @Req() req: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
  ) {
    return this.collectionService.listChatMessages(req.user.id, sessionId);
  }

  @Post('chat-sessions/:sessionId/messages')
  async createChatMessage(
    @Req() req: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() dto: CreateCollectionChatMessageDto,
  ) {
    return this.collectionService.createChatMessage(
      req.user.id,
      sessionId,
      dto,
    );
  }
}
