import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateTopicConversationMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message!: string;
}
