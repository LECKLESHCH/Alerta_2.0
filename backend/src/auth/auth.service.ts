import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'crypto';
import { Model } from 'mongoose';
import { UserAccount, UserDocument } from './auth.schema';

type AuthTokenPayload = {
  sub: string;
  email: string;
  displayName: string;
  role: string;
  iat: number;
  exp: number;
};

type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
};

type AuthResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: PublicUser;
};

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresInSeconds: number;

  constructor(
    @InjectModel(UserAccount.name)
    private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret =
      this.configService.get<string>('JWT_SECRET') ||
      'alerta-dev-insecure-secret';
    this.jwtExpiresInSeconds = Number(
      this.configService.get<string>('JWT_EXPIRES_IN_SECONDS') || '43200',
    );
  }

  async register(input: {
    email?: string;
    password?: string;
    displayName?: string;
  }): Promise<AuthResponse> {
    const email = this.normalizeEmail(input.email);
    const password = this.validatePassword(input.password);
    const displayName = this.validateDisplayName(input.displayName);

    const existingUser = await this.userModel.findOne({ email }).lean().exec();
    if (existingUser) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }

    const passwordSalt = randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(password, passwordSalt);

    const user = await this.userModel.create({
      email,
      displayName,
      passwordHash,
      passwordSalt,
      role: 'admin',
    });

    return this.buildAuthResponse(user);
  }

  async login(input: {
    email?: string;
    password?: string;
  }): Promise<AuthResponse> {
    const email = this.normalizeEmail(input.email);
    const password = this.validatePassword(input.password);
    const user = await this.userModel.findOne({ email }).exec();

    if (!user) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    const passwordHash = this.hashPassword(password, user.passwordSalt);
    const provided = Buffer.from(passwordHash, 'hex');
    const expected = Buffer.from(user.passwordHash, 'hex');
    const isValid =
      provided.length === expected.length &&
      timingSafeEqual(provided, expected);

    if (!isValid) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    return this.buildAuthResponse(user);
  }

  async getProfileFromToken(token: string): Promise<PublicUser> {
    const payload = this.verifyToken(token);
    const user = await this.userModel.findById(payload.sub).exec();

    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }

    return this.toPublicUser(user);
  }

  extractBearerToken(authorizationHeader?: string): string {
    if (!authorizationHeader) {
      throw new UnauthorizedException('Отсутствует токен доступа');
    }

    const [type, token] = authorizationHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Некорректный формат токена');
    }

    return token;
  }

  verifyToken(token: string): AuthTokenPayload {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      throw new UnauthorizedException('Некорректный токен');
    }

    const data = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = this.base64UrlEncode(
      createHmac('sha256', this.jwtSecret).update(data).digest(),
    );

    const providedBuffer = Buffer.from(encodedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);
    const isValidSignature =
      providedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(providedBuffer, expectedBuffer);

    if (!isValidSignature) {
      throw new UnauthorizedException('Подпись токена не прошла проверку');
    }

    const payload = JSON.parse(
      this.base64UrlDecode(encodedPayload).toString('utf8'),
    ) as AuthTokenPayload;

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Срок действия токена истек');
    }

    return payload;
  }

  private buildAuthResponse(user: UserDocument): AuthResponse {
    const publicUser = this.toPublicUser(user);
    return {
      accessToken: this.signToken(publicUser),
      tokenType: 'Bearer',
      expiresIn: this.jwtExpiresInSeconds,
      user: publicUser,
    };
  }

  private signToken(user: PublicUser): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: AuthTokenPayload = {
      sub: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      iat: now,
      exp: now + this.jwtExpiresInSeconds,
    };

    const encodedHeader = this.base64UrlEncode(
      Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
    );
    const encodedPayload = this.base64UrlEncode(
      Buffer.from(JSON.stringify(payload)),
    );
    const encodedSignature = this.base64UrlEncode(
      createHmac('sha256', this.jwtSecret)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest(),
    );

    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  }

  private toPublicUser(user: UserDocument): PublicUser {
    return {
      id: user._id.toString(),
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
  }

  private hashPassword(password: string, salt: string): string {
    return scryptSync(password, salt, 64).toString('hex');
  }

  private normalizeEmail(email?: string): string {
    const normalized = (email || '').trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) {
      throw new UnauthorizedException('Укажите корректный email');
    }
    return normalized;
  }

  private validatePassword(password?: string): string {
    const normalized = (password || '').trim();
    if (normalized.length < 8) {
      throw new UnauthorizedException(
        'Пароль должен содержать не менее 8 символов',
      );
    }
    return normalized;
  }

  private validateDisplayName(displayName?: string): string {
    const normalized = (displayName || '').trim();
    if (normalized.length < 3) {
      throw new UnauthorizedException(
        'Имя пользователя должно содержать не менее 3 символов',
      );
    }
    return normalized;
  }

  private base64UrlEncode(value: Buffer): string {
    return value
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  private base64UrlDecode(value: string): Buffer {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded =
      normalized.length % 4 === 0
        ? normalized
        : normalized.padEnd(normalized.length + (4 - (normalized.length % 4)), '=');
    return Buffer.from(padded, 'base64');
  }
}

