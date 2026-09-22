import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { fromNodeHeaders } from 'better-auth/node';
import { twoFactor, username } from 'better-auth/plugins';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { prisma } from './db.js';
import { AppError } from './errors.js';
import { isKnownWeakPassword, recordSecurityEvent } from './security.js';

export type RegistrationMode = 'OPEN' | 'INVITE_ONLY' | 'CLOSED';

export type AuthOptions = {
  baseURL: string;
  webOrigin: string;
  trustedOrigins?: string[];
  secret: string;
  sessionTtlDays: number;
  secureCookie: boolean;
  registrationMode: RegistrationMode;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  username: string | null;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'DISABLED';
  preferredLanguage: string;
  twoFactorEnabled: boolean;
  createdAt: Date;
};

export function createNazemniAuth(options: AuthOptions) {
  return betterAuth({
    appName: 'Nazemni',
    baseURL: options.baseURL,
    basePath: '/api/auth',
    secret: options.secret,
    trustedOrigins: [options.webOrigin, ...(options.trustedOrigins ?? [])],
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      password: {
        hash: (password) => bcrypt.hash(password, 12),
        verify: ({ password, hash }) => bcrypt.compare(password, hash),
      },
    },
    user: {
      additionalFields: {
        role: { type: 'string', required: true, defaultValue: 'USER', input: false },
        status: { type: 'string', required: true, defaultValue: 'ACTIVE', input: false },
        preferredLanguage: { type: 'string', required: true, defaultValue: 'ar' },
        lastLoginAt: { type: 'date', required: false, input: false },
      },
    },
    session: {
      expiresIn: options.sessionTtlDays * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
      freshAge: 15 * 60,
    },
    advanced: {
      useSecureCookies: options.secureCookie,
      // Render sets the first X-Forwarded-For value to the real client IP.
      // Never trust the separately client-spoofable x-vercel-forwarded-for header.
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
      cookiePrefix: 'nazemni',
      defaultCookieAttributes: {
        httpOnly: true,
        secure: options.secureCookie,
        sameSite: 'lax',
        path: '/',
      },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      modelName: 'rateLimit',
      window: 60,
      max: 60,
      customRules: {
        '/sign-in/email': { window: 15 * 60, max: 8 },
        '/sign-in/username': { window: 15 * 60, max: 8 },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const user = await prisma.user.findUnique({
              where: { id: session.userId },
              select: { status: true },
            });
            if (!user || user.status !== 'ACTIVE') {
              throw new APIError('UNAUTHORIZED', { message: 'Invalid email, username, or password' });
            }
            return { data: session };
          },
        },
      },
    },
    hooks: {
      after: createAuthMiddleware(async (context) => {
        if (context.path.startsWith('/sign-in') && context.context.newSession) {
          const userId = context.context.newSession.user.id;
          await prisma.user.update({
            where: { id: userId },
            data: { lastLoginAt: new Date() },
          });
          await recordSecurityEvent({ event: 'LOGIN_SUCCESS', actorUserId: userId });
        }
        if (context.path === '/two-factor/verify-totp' || context.path === '/two-factor/verify-backup-code') {
          const userId = context.context.newSession?.user.id;
          if (userId) {
            await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
            await recordSecurityEvent({ event: 'LOGIN_SUCCESS_2FA', actorUserId: userId });
          }
        }
        if (context.path === '/two-factor/enable' || context.path === '/two-factor/disable') {
          const userId = context.context.session?.user.id;
          if (userId) await recordSecurityEvent({
            event: context.path.endsWith('/enable') ? 'TWO_FACTOR_ENROLLMENT_STARTED' : 'TWO_FACTOR_DISABLED',
            actorUserId: userId,
          });
        }
      }),
    },
    plugins: [
      username({
        minUsernameLength: 3,
        maxUsernameLength: 64,
        usernameValidator: (value) => /^[a-zA-Z0-9_.-]+$/.test(value),
      }),
      twoFactor({
        issuer: 'Nazemni',
        skipVerificationOnEnable: false,
        accountLockout: { enabled: true, maxFailedAttempts: 5, durationSeconds: 15 * 60 },
        backupCodeOptions: { amount: 10, length: 12, storeBackupCodes: 'encrypted' },
      }),
    ],
  });
}

export type NazemniAuth = ReturnType<typeof createNazemniAuth>;

export function inviteCodeHash(code: string) {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

export function generateInviteCode() {
  return 'NZM-' + randomBytes(12).toString('base64url').toUpperCase();
}

export async function readAuthSession(request: Request, auth: NazemniAuth) {
  return auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
}

export function requireAuthentication(auth: NazemniAuth): RequestHandler {
  return async (request, response, next) => {
    try {
      const session = await readAuthSession(request, auth);
      if (!session) throw new AppError(401, 'Authentication required');
      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (!user || user.status !== 'ACTIVE') {
        if (session.session?.token) {
          await prisma.session.deleteMany({ where: { token: session.session.token } });
        }
        throw new AppError(401, 'Authentication required');
      }
      response.locals.authUser = user satisfies AuthUser;
      response.locals.authSession = session.session;
      if (user.role === 'ADMIN' && !user.twoFactorEnabled
        && !request.originalUrl.startsWith('/api/account/profile')) {
        throw new AppError(403, 'Two-factor authentication setup is required', 'TWO_FACTOR_SETUP_REQUIRED');
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAdmin(_request: Request, response: Response, next: NextFunction) {
  const user = response.locals.authUser as AuthUser | undefined;
  if (!user || user.role !== 'ADMIN') {
    next(new AppError(403, 'Forbidden'));
    return;
  }
  next();
}

export function authUser(response: Response) {
  const user = response.locals.authUser as AuthUser | undefined;
  if (!user) throw new AppError(401, 'Authentication required');
  return user;
}

export const registrationInput = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  username: z.string().trim().min(3).max(64).regex(/^[a-zA-Z0-9_.-]+$/).transform((value) => value.toLowerCase()),
  displayName: z.string().trim().min(2).max(100),
  password: z.string().min(10).max(128),
  preferredLanguage: z.enum(['ar', 'en']).default('ar'),
  inviteCode: z.string().trim().max(128).optional(),
}).strict().superRefine((value, context) => {
  if (isKnownWeakPassword(value.password)) {
    context.addIssue({ code: 'custom', path: ['password'], message: 'Choose a less common password' });
  }
});
