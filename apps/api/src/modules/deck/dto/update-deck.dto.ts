import { IsString, IsInt, IsOptional, MaxLength, Min, Max } from 'class-validator';

export class UpdateDeckDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(100)
  dailyNewCards?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(500)
  dailyReviewCards?: number;
}
