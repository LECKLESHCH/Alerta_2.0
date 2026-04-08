import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

export type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    email: string;
    displayName: string;
    role: string;
  };
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException('Требуется авторизация');
    }

    const token = this.authService.extractBearerToken(authorization);
    request.user = await this.authService.getProfileFromToken(token);
    return true;
  }
}

