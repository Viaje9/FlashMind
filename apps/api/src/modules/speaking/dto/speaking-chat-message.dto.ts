import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class SpeakingChatMessageDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content: string;
}
