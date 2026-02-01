import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { AuthGuard } from './auth.guard';
import { WhitelistGuard } from './whitelist.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionService, AuthGuard, WhitelistGuard],
  exports: [AuthService, SessionService, AuthGuard, WhitelistGuard],
})
export class AuthModule {}
