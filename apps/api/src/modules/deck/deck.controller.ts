import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DeckService } from './deck.service';
import { CreateDeckDto, UpdateDeckDto, SetDailyOverrideDto } from './dto';
import { AuthGuard } from '../auth/auth.guard';
import { WhitelistGuard } from '../auth/whitelist.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';

@Controller('decks')
@UseGuards(AuthGuard, WhitelistGuard)
export class DeckController {
  constructor(private readonly deckService: DeckService) {}

  @Get()
  async listDecks(@Req() req: AuthenticatedRequest) {
    const decks = await this.deckService.findAllByUserId(
      req.user.id,
      req.user.timezone,
    );
    return { data: decks };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createDeck(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateDeckDto,
  ) {
    return this.deckService.create(req.user.id, dto);
  }

  @Get(':id')
  async getDeck(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const deck = await this.deckService.findById(id, req.user.id);
    return { data: deck };
  }

  @Patch(':id')
  async updateDeck(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateDeckDto,
  ) {
    return this.deckService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDeck(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.deckService.delete(id, req.user.id);
  }

  @Put(':id/daily-override')
  async setDailyOverride(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SetDailyOverrideDto,
  ) {
    return this.deckService.setDailyOverride(
      id,
      req.user.id,
      dto,
      req.user.timezone,
    );
  }
}
