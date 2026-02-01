import { IsOptional, IsInt, Min } from 'class-validator';

export class SetDailyOverrideDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  newCards?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  reviewCards?: number;
}
