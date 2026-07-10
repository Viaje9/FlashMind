import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsLearningSteps } from './learning-steps.validator';

class ImportDeckMeaningDto {
  @IsString()
  @IsNotEmpty()
  zhMeaning: string;

  @IsOptional()
  @IsString()
  enExample: string | null;

  @IsOptional()
  @IsString()
  zhExample: string | null;

  @IsInt()
  @Min(0)
  sortOrder: number;
}

class ImportDeckCardDto {
  @IsString()
  @IsNotEmpty()
  front: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportDeckMeaningDto)
  meanings: ImportDeckMeaningDto[];
}

export class ImportDeckDto {
  @IsInt()
  @IsIn([1])
  version: 1;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsInt()
  @Min(5)
  @Max(100)
  dailyNewCards: number;

  @IsInt()
  @Min(10)
  @Max(500)
  dailyReviewCards: number;

  @IsInt()
  @Min(0)
  @Max(23)
  dailyResetHour: number;

  @IsString()
  @IsLearningSteps()
  learningSteps: string;

  @IsString()
  @IsLearningSteps()
  relearningSteps: string;

  @IsNumber()
  @Min(0.7)
  @Max(0.97)
  requestRetention: number;

  @IsInt()
  @Min(30)
  @Max(36500)
  maximumInterval: number;

  @IsBoolean()
  enableReverse: boolean;

  @IsArray()
  @ArrayMaxSize(10000)
  @ValidateNested({ each: true })
  @Type(() => ImportDeckCardDto)
  cards: ImportDeckCardDto[];
}
