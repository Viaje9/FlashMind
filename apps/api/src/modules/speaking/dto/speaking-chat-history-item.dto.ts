import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SpeakingChatHistoryItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  id?: string;

  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  audioBase64?: string;
}
