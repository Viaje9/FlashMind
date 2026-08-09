import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SpeakingAssistantMessageDto } from './speaking-assistant-message.dto';

export const SPEAKING_ASSISTANT_EFFORTS = [
  'none',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const;

export type SpeakingAssistantEffort =
  (typeof SPEAKING_ASSISTANT_EFFORTS)[number];

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

  @IsOptional()
  @IsString()
  @IsIn(SPEAKING_ASSISTANT_EFFORTS)
  effort?: SpeakingAssistantEffort;
}
