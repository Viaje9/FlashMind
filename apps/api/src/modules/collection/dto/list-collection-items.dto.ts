import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { CollectionItemKindDto } from './collection-item-kind.dto';

export class ListCollectionItemsDto {
  @IsOptional()
  @IsEnum(CollectionItemKindDto)
  kind?: CollectionItemKindDto;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
