import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    extractBearerToken: jest.fn(),
    getProfileFromToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('should delegate register to auth service', async () => {
    authService.register.mockResolvedValue({ accessToken: 'jwt' });

    await expect(
      controller.register({
        email: 'admin@example.com',
        password: 'password123',
        displayName: 'ALERTA_Admin_1',
      }),
    ).resolves.toEqual({ accessToken: 'jwt' });
  });

  it('should resolve current user from bearer token', async () => {
    authService.extractBearerToken.mockReturnValue('jwt-token');
    authService.getProfileFromToken.mockResolvedValue({
      id: '1',
      email: 'admin@example.com',
      displayName: 'ALERTA_Admin_1',
      role: 'admin',
    });

    await expect(controller.me('Bearer jwt-token')).resolves.toEqual({
      user: {
        id: '1',
        email: 'admin@example.com',
        displayName: 'ALERTA_Admin_1',
        role: 'admin',
      },
    });
  });
});
