import { randomBytes, scryptSync } from 'crypto';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../src/app.module';
import { UserAccount, UserDocument } from '../src/auth/auth.schema';

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const userModel = app.get<Model<UserDocument>>(getModelToken(UserAccount.name));

    const email = (process.env.AUTH_RESET_EMAIL || 'alerta@mail.ru').trim().toLowerCase();
    const displayName = (process.env.AUTH_RESET_DISPLAY_NAME || 'Alerta Admin').trim();
    const password = (process.env.AUTH_RESET_PASSWORD || 'Alerta2026!').trim();

    if (!email.includes('@')) {
      throw new Error('AUTH_RESET_EMAIL is invalid');
    }
    if (password.length < 8) {
      throw new Error('AUTH_RESET_PASSWORD must be at least 8 characters');
    }

    const passwordSalt = randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, passwordSalt);

    const existing = await userModel.findOne({ email }).exec();
    if (existing) {
      existing.displayName = displayName || existing.displayName;
      existing.passwordSalt = passwordSalt;
      existing.passwordHash = passwordHash;
      existing.role = existing.role || 'admin';
      await existing.save();
      // eslint-disable-next-line no-console
      console.log(`Updated auth user: ${email}`);
    } else {
      await userModel.create({
        email,
        displayName: displayName || 'Alerta Admin',
        passwordSalt,
        passwordHash,
        role: 'admin',
      });
      // eslint-disable-next-line no-console
      console.log(`Created auth user: ${email}`);
    }

    // eslint-disable-next-line no-console
    console.log(`Password reset complete for ${email}`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});

