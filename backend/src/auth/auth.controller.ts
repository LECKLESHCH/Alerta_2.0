import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(
    @Body()
    body: {
      email?: string;
      password?: string;
      displayName?: string;
    },
  ) {
    return this.authService.register(body);
  }

  @Post('login')
  login(
    @Body()
    body: {
      email?: string;
      password?: string;
    },
  ) {
    return this.authService.login(body);
  }

  @Get('me')
  async me(@Headers('authorization') authorization?: string) {
    const token = this.authService.extractBearerToken(authorization);
    const user = await this.authService.getProfileFromToken(token);
    return { user };
  }
}

