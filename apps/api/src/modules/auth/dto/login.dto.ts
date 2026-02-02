import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Email 格式不正確' })
  email: string;

  @IsString()
  @MinLength(8, { message: '密碼至少需要 8 個字元' })
  password: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
