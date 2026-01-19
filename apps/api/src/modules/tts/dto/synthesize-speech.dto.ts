import { IsString, MinLength, MaxLength } from 'class-validator';

export class SynthesizeSpeechDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text: string;
}
