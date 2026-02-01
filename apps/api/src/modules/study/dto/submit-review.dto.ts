import { IsString, IsIn, IsOptional } from 'class-validator';

export class SubmitReviewDto {
  @IsString()
  cardId: string;

  @IsIn(['known', 'unfamiliar', 'unknown'])
  rating: 'known' | 'unfamiliar' | 'unknown';

  @IsOptional()
  @IsIn(['FORWARD', 'REVERSE'])
  direction?: 'FORWARD' | 'REVERSE';
}
