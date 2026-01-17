import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Email 格式不正確' })
  email: string;

  @IsString()
  @MinLength(8, { message: '密碼至少需要 8 個字元' })
  password: string;
}
