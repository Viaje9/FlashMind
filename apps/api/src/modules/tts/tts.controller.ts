import {
  Controller,
  Post,
  Body,
  UseGuards,
  StreamableFile,
  Header,
} from '@nestjs/common';
import { TtsService } from './tts.service';
import { SynthesizeSpeechDto, SynthesizeWordDto } from './dto';
import { AuthGuard } from '../auth/auth.guard';
import { WhitelistGuard } from '../auth/whitelist.guard';

@Controller('tts')
@UseGuards(AuthGuard, WhitelistGuard)
export class TtsController {
  constructor(private readonly ttsService: TtsService) {}

  @Post('synthesize')
  @Header('Content-Type', 'audio/mpeg')
  async synthesizeSpeech(
    @Body() dto: SynthesizeSpeechDto,
  ): Promise<StreamableFile> {
    const audioBuffer = await this.ttsService.synthesize(dto.text);
    return new StreamableFile(audioBuffer);
  }

  @Post('word')
  @Header('Content-Type', 'audio/mpeg')
  async synthesizeWord(
    @Body() dto: SynthesizeWordDto,
  ): Promise<StreamableFile> {
    const audioBuffer = await this.ttsService.synthesizeWord(dto.text);
    return new StreamableFile(audioBuffer);
  }
}
