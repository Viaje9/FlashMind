import { IsString, MinLength, MaxLength } from 'class-validator';

export class GenerateCardContentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  text: string;
}
