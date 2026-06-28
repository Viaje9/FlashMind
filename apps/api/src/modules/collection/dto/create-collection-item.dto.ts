import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { CollectionItemKindDto } from './collection-item-kind.dto';
import { CollectionRelationTypeDto } from './collection-relation-type.dto';

export class CollectionSaveRelatedCandidateDto {
  @IsEnum(CollectionItemKindDto)
  kind!: CollectionItemKindDto;

  @IsString()
  @MaxLength(500)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  meaning?: string;

  @IsEnum(CollectionRelationTypeDto)
  type!: CollectionRelationTypeDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sourceCardIds?: string[];
}

export class CreateCollectionItemDto {
  @IsEnum(CollectionItemKindDto)
  kind!: CollectionItemKindDto;

  @IsString()
  @MaxLength(500)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  meaning?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  createdFrom?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sourceCardIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollectionSaveRelatedCandidateDto)
  relatedCandidates?: CollectionSaveRelatedCandidateDto[];
}
