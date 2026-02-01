import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedRequest } from './auth.guard';

@Injectable()
export class WhitelistGuard implements CanActivate {
  private readonly enabled: boolean;
  private readonly allowedUserIds: Set<string>;

  constructor(private readonly configService: ConfigService) {
    this.enabled =
      this.configService.get<string>('WHITELIST_ENABLED') === 'true';
    const userIds = this.configService.get<string>('WHITELIST_USER_IDS') || '';
    this.allowedUserIds = new Set(
      userIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    );
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.enabled) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id;

    if (!userId || !this.allowedUserIds.has(userId)) {
      throw new ForbiddenException({
        error: {
          code: 'WHITELIST_DENIED',
          message: '目前僅開放受邀使用者使用',
        },
      });
    }

    return true;
  }
}
