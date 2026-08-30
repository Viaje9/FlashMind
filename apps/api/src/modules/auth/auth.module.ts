import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { AuthGuard } from './auth.guard';
import { WhitelistGuard } from './whitelist.guard';
import { CliAuthService } from './cli-auth.service';
import { CliAuthController } from './cli-auth.controller';

@Module({
  controllers: [AuthController, CliAuthController],
  providers: [
    AuthService,
    SessionService,
    AuthGuard,
    WhitelistGuard,
    CliAuthService,
  ],
  exports: [AuthService, SessionService, AuthGuard, WhitelistGuard],
})
export class AuthModule {}
