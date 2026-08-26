import {
  Body,
  Controller,
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
import {
  AddTargetVocabularyToDeckDto,
  ImportTargetVocabularyDto,
  ListTargetVocabularyDto,
} from './dto';
import { TargetVocabularyService } from './target-vocabulary.service';

@Controller('target-vocabulary')
@UseGuards(AuthGuard, WhitelistGuard)
export class TargetVocabularyController {
  constructor(private readonly service: TargetVocabularyService) {}

  @Get()
  listWords(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListTargetVocabularyDto,
  ) {
    return this.service.listWords(req.user.id, query);
  }

  @Post('import')
  @HttpCode(HttpStatus.CREATED)
  importWords(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ImportTargetVocabularyDto,
  ) {
    return this.service.importWords(req.user.id, dto);
  }

  @Post(':id/add-to-deck')
  @HttpCode(HttpStatus.CREATED)
  addToDeck(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AddTargetVocabularyToDeckDto,
  ) {
    return this.service.addToDeck(req.user.id, id, dto);
  }
}
