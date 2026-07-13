import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateTopicConversationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  scenario!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  openingMessage!: string;
}
