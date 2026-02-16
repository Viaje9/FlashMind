import { IsString, MaxLength, MinLength } from 'class-validator';

export class SpeakingTranslateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text: string;
}
