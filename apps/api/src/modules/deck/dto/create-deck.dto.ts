import { IsString, IsInt, IsOptional, IsNumber, IsBoolean, MaxLength, Min, Max } from 'class-validator';
import { IsLearningSteps } from './learning-steps.validator';

export class CreateDeckDto {
  @IsString()
  @MaxLength(100)
  name: string;

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

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  dailyResetHour?: number;

  @IsOptional()
  @IsString()
  @IsLearningSteps()
  learningSteps?: string;

  @IsOptional()
  @IsString()
  @IsLearningSteps()
  relearningSteps?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.70)
  @Max(0.97)
  requestRetention?: number;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(36500)
  maximumInterval?: number;

  @IsOptional()
  @IsBoolean()
  enableReverse?: boolean;
}
