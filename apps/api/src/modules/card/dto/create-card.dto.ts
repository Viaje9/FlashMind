import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCardMeaningDto {
  @IsString()
  @IsNotEmpty()
  zhMeaning: string;

  @IsString()
  @IsOptional()
  enExample?: string;

  @IsString()
  @IsOptional()
  zhExample?: string;
}

export class CreateCardDto {
  @IsString()
  @IsNotEmpty()
  front: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCardMeaningDto)
  meanings: CreateCardMeaningDto[];
}
