import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    timezone: string;
  };
  sessionToken: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sessionToken = this.extractSessionToken(request);

    if (!sessionToken) {
      throw new UnauthorizedException({
        error: {
          code: 'UNAUTHORIZED',
          message: '請先登入',
        },
      });
    }

    const session = await this.sessionService.validateSession(sessionToken);

    if (!session) {
      throw new UnauthorizedException({
        error: {
          code: 'UNAUTHORIZED',
          message: '請先登入',
        },
      });
    }

    request.user = {
      id: session.user.id,
      email: session.user.email,
      timezone: session.user.timezone,
    };
    request.sessionToken = sessionToken;

    return true;
  }

  private extractSessionToken(request: Request): string | null {
    const cookies = request.cookies as Record<string, string>;
    return cookies?.session ?? null;
  }
}
