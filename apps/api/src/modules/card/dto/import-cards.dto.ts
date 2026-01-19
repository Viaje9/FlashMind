import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateCardDto } from './create-card.dto';

export class ImportCardsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCardDto)
  cards: CreateCardDto[];
}

export interface ImportCardError {
  index: number;
  message: string;
}

export interface ImportCardsResult {
  total: number;
  success: number;
  failed: number;
  errors: ImportCardError[];
}
