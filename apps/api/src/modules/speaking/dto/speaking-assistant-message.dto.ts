import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class SpeakingAssistantMessageDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;
}
