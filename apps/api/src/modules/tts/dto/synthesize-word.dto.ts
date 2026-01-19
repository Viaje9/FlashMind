import { IsString, MinLength, MaxLength } from 'class-validator';

export class SynthesizeWordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  text: string;
}
