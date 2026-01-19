import { IsString, IsIn } from 'class-validator';

export class SubmitReviewDto {
  @IsString()
  cardId: string;

  @IsIn(['known', 'unfamiliar', 'unknown'])
  rating: 'known' | 'unfamiliar' | 'unknown';
}
