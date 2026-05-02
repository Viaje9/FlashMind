import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCollectionChatMessageDto {
  @IsString()
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  intentHint?: string;
}
