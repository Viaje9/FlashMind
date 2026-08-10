import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCardMeaningDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  zhMeaning?: string;

  @IsString()
  @IsOptional()
  enExample?: string | null;

  @IsString()
  @IsOptional()
  zhExample?: string | null;
}

export class UpdateCardDto {
  @IsString()
  @IsOptional()
  front?: string;

  @IsString()
  @IsOptional()
  note?: string | null;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateCardMeaningDto)
  meanings?: UpdateCardMeaningDto[];
}
