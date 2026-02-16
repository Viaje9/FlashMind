import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { SpeakingChatHistoryItemDto } from './speaking-chat-history-item.dto';

export class SpeakingSummarizeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpeakingChatHistoryItemDto)
  history: SpeakingChatHistoryItemDto[];
}
