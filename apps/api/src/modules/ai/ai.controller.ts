import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { GenerateCardContentDto } from './dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('ai')
@UseGuards(AuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate-card-content')
  async generateCardContent(@Body() dto: GenerateCardContentDto) {
    const result = await this.aiService.generateCardContent(dto.text);
    return { data: result };
  }
}
