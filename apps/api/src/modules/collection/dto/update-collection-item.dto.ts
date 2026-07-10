import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCollectionItemDto {
  @IsString()
  @MaxLength(500)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  meaning?: string;
}
