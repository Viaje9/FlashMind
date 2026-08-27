import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export enum TargetVocabularyStatusDto {
  UNSEEN = 'UNSEEN',
  PRACTICING = 'PRACTICING',
  USED = 'USED',
  ADDED = 'ADDED',
}

export class ListTargetVocabularyDto {
  @IsEnum(TargetVocabularyStatusDto)
  @IsOptional()
  status?: TargetVocabularyStatusDto;

  @IsString()
  @IsOptional()
  q?: string;
}

export class ImportTargetVocabularyWordDto {
  @IsString()
  @IsNotEmpty()
  term: string;

  @IsString()
  @IsNotEmpty()
  zhMeaning: string;
}

export class ImportTargetVocabularyDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportTargetVocabularyWordDto)
  words: ImportTargetVocabularyWordDto[];
}

export class AddTargetVocabularyToDeckDto {
  @IsString()
  @IsNotEmpty()
  deckId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  term: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  zhMeaning: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  naturalSentence?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  zhExample?: string;
}
