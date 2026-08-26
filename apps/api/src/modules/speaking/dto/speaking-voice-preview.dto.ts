import { IsIn, IsOptional } from 'class-validator';

export class SpeakingVoicePreviewDto {
  @IsOptional()
  @IsIn([
    'alloy',
    'ash',
    'ballad',
    'coral',
    'cedar',
    'echo',
    'marin',
    'sage',
    'shimmer',
    'verse',
  ])
  voice?:
    | 'alloy'
    | 'ash'
    | 'ballad'
    | 'coral'
    | 'cedar'
    | 'echo'
    | 'marin'
    | 'sage'
    | 'shimmer'
    | 'verse';
}
