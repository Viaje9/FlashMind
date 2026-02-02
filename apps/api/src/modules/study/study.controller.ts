import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { WhitelistGuard } from '../auth/whitelist.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { StudyService } from './study.service';
import { SubmitReviewDto } from './dto';

@Controller('decks/:deckId/study')
@UseGuards(AuthGuard, WhitelistGuard)
export class StudyController {
  constructor(private readonly studyService: StudyService) {}

  @Get('cards')
  async getStudyCards(
    @Param('deckId') deckId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const cards = await this.studyService.getStudyCards(
      deckId,
      req.user.id,
      req.user.timezone,
    );
    return { data: cards };
  }

  @Post('review')
  async submitReview(
    @Param('deckId') deckId: string,
    @Body() dto: SubmitReviewDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.studyService.submitReview(
      deckId,
      dto.cardId,
      dto.rating,
      req.user.id,
      dto.direction,
    );
    return { data: result };
  }

  @Get('summary')
  async getSummary(
    @Param('deckId') deckId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const summary = await this.studyService.getSummary(
      deckId,
      req.user.id,
      req.user.timezone,
    );
    return { data: summary };
  }
}
