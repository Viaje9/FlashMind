import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SpeakingAssistantMessageDto } from './speaking-assistant-message.dto';

export class SpeakingAssistantChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpeakingAssistantMessageDto)
  history?: SpeakingAssistantMessageDto[];
}
