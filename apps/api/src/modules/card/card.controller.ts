import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CardService } from './card.service';
import { CreateCardDto, UpdateCardDto } from './dto';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';

@Controller('decks/:deckId/cards')
@UseGuards(AuthGuard)
export class CardController {
  constructor(private readonly cardService: CardService) {}

  @Get()
  async listCards(
    @Req() req: AuthenticatedRequest,
    @Param('deckId') deckId: string,
  ) {
    const cards = await this.cardService.findAllByDeckId(deckId, req.user.id);
    return { data: cards };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCard(
    @Req() req: AuthenticatedRequest,
    @Param('deckId') deckId: string,
    @Body() dto: CreateCardDto,
  ) {
    return this.cardService.create(deckId, req.user.id, dto);
  }

  @Get(':cardId')
  async getCard(
    @Req() req: AuthenticatedRequest,
    @Param('deckId') deckId: string,
    @Param('cardId') cardId: string,
  ) {
    const card = await this.cardService.findById(cardId, deckId, req.user.id);
    return { data: card };
  }

  @Patch(':cardId')
  async updateCard(
    @Req() req: AuthenticatedRequest,
    @Param('deckId') deckId: string,
    @Param('cardId') cardId: string,
    @Body() dto: UpdateCardDto,
  ) {
    return this.cardService.update(cardId, deckId, req.user.id, dto);
  }

  @Delete(':cardId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCard(
    @Req() req: AuthenticatedRequest,
    @Param('deckId') deckId: string,
    @Param('cardId') cardId: string,
  ) {
    await this.cardService.delete(cardId, deckId, req.user.id);
  }
}
