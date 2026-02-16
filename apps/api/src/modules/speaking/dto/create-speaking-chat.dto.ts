import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SpeakingChatMessageDto } from './speaking-chat-message.dto';

export class CreateSpeakingChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  message: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpeakingChatMessageDto)
  history?: SpeakingChatMessageDto[];

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  systemPrompt?: string;
}
