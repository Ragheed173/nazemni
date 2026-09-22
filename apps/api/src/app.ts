import { basename } from 'node:path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { toNodeHandler } from 'better-auth/node';
import { pinoHttp } from 'pino-http';
import { readAuthSession, requireAuthentication, type NazemniAuth, type RegistrationMode } from './auth.js';
import { AppError, errorHandler, notFound } from './errors.js';
import { createAccountRouter, createAdminRouter, createPublicAccountRouter } from './routes/account.js';
import { entityRouter } from './routes/entities.js';
import { planningRouter } from './routes/planning.js';
import { semesterManagementRouter } from './routes/semester-management.js';
import { createAIRouter } from './routes/ai.js';
import type { AIProvider } from './ai/provider.js';
import { defaultAIRuntimeConfig, type AIRuntimeConfig } from './ai/service.js';
import { prisma } from './db.js';
import { durableRateLimit, recordSecurityEvent, rejectOversizedRequest, requireTrustedOrigin } from './security.js';

type AppOptions = {
  webOrigin?: string;
  trustedOrigins?: string[];
  webDistPath?: string;
  auth: NazemniAuth;
  registrationMode: RegistrationMode;
  secureCookie?: boolean;
  aiConfig?: AIRuntimeConfig;
  aiProvider?: AIProvider;
};

export function createApp({
  webOrigin = 'http://localhost:5173',
  trustedOrigins = [],
  webDistPath,
  auth,
  registrationMode,
  secureCookie = false,
  aiConfig = defaultAIRuntimeConfig,
  aiProvider,
}: AppOptions) {
  const app = express();
  if (secureCookie) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: false,
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'no-referrer' },
  }));
  app.use((_request, response, next) => {
    response.set('Content-Security-Policy-Report-Only', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; upgrade-insecure-requests");
    response.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    next();
  });
  app.use(cors({ origin: [webOrigin, ...trustedOrigins], credentials: true }));
  app.use(pinoHttp({
    redact: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.headers.x-vercel-proxy-signature',
      'req.headers.x-vercel-signature',
      'req.headers.x-api-key',
      'res.headers.set-cookie',
      'response.headers.set-cookie',
      'req.body.password',
      'req.body.currentPassword',
      'req.body.newPassword',
      'req.body.confirmation',
      'req.body.code',
      'req.body.backupCode',
      'req.body.totpURI',
      'req.body.backupCodes',
      'req.body.secret',
      'req.body.token',
      'req.body.resetToken',
      'req.body.apiKey',
    ],
  }));
  app.get('/health', (_request, response) => response.json({ ok: true, data: { status: 'healthy' } }));
  app.use('/api', (_request, response, next) => {
    response.set('Cache-Control', 'no-store, private');
    next();
  });
  app.get('/api/health', (_request, response) => response.json({ ok: true, data: { status: 'healthy' } }));

  app.use('/api', requireTrustedOrigin([webOrigin, ...trustedOrigins]));
  app.use('/api', rejectOversizedRequest(256 * 1024));
  app.use('/api/auth', rejectOversizedRequest(64 * 1024));
  const primaryAuthenticationAttemptLimit = durableRateLimit({
    namespace: 'primary-authentication-attempt',
    windowMs: 15 * 60_000,
    limit: 8,
  });
  const mfaVerificationAttemptLimit = durableRateLimit({
    namespace: 'mfa-verification-attempt',
    windowMs: 15 * 60_000,
    limit: 10,
  });
  app.use('/api/auth', (request, response, next) => {
    const isPrimaryAuthentication = request.path.startsWith('/sign-in/');
    const isMfaVerification = request.path === '/two-factor/verify-totp'
      || request.path === '/two-factor/verify-backup-code';
    const isAuthenticationAttempt = isPrimaryAuthentication || isMfaVerification;
    if (isAuthenticationAttempt) {
      attachAuthenticationFailureAudit(request, response);
      const limiter = isPrimaryAuthentication ? primaryAuthenticationAttemptLimit : mfaVerificationAttemptLimit;
      limiter(request, response, (limitError) => {
        if (limitError) return next(limitError);
        next();
      });
      return;
    }
    next();
  });
  function attachAuthenticationFailureAudit(request: express.Request, response: express.Response) {
    const isAuthenticationAttempt = request.path.startsWith('/sign-in/')
      || request.path === '/two-factor/verify-totp'
      || request.path === '/two-factor/verify-backup-code';
    if (isAuthenticationAttempt) {
      response.once('finish', () => {
        if (response.statusCode >= 400) {
          void recordSecurityEvent({ event: 'LOGIN_FAILURE', request, metadata: { path: request.path } })
            .catch((error) => request.log.error({
              event: 'security_audit_failed',
              errorType: error instanceof Error ? error.name : typeof error,
            }));
        }
      });
    }
  }
  app.post('/api/auth/two-factor/disable', async (request, _response, next) => {
    try {
      const session = await readAuthSession(request, auth);
      if (session) {
        const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
        if (user?.role === 'ADMIN') throw new AppError(403, 'Administrators must keep two-factor authentication enabled');
      }
      next();
    } catch (error) {
      next(error);
    }
  });
  app.all('/api/auth/*splat', toNodeHandler(auth));
  app.use(express.json({ limit: '256kb' }));
  app.use('/api/public', createPublicAccountRouter(registrationMode));

  const requireAuth = requireAuthentication(auth);
  app.use('/api/account', requireAuth, createAccountRouter());
  app.use('/api/admin', requireAuth, createAdminRouter(registrationMode));
  app.use('/api/ai', requireAuth, createAIRouter(aiConfig, aiProvider));
  app.use('/api', requireAuth, entityRouter);
  app.use('/api', requireAuth, planningRouter);
  app.use('/api', requireAuth, semesterManagementRouter);

  if (webDistPath) {
    app.use(express.static(webDistPath, {
      index: false,
      maxAge: '1h',
      setHeaders(response, filePath) {
        const file = basename(filePath);
        if (file === 'sw.js' || file === 'manifest.webmanifest' || file === 'index.html') {
          response.setHeader('Cache-Control', 'no-cache');
        } else if (filePath.includes('/assets/') || filePath.includes('\\assets\\')) {
          response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }));
    app.use(async (request, response, next) => {
      try {
        if (request.method === 'GET' && !request.path.startsWith('/api') && request.accepts('html')) {
          const publicPath = request.path === '/' || request.path === '/login' || request.path === '/register';
          const session = await readAuthSession(request, auth);
          if (!publicPath && !session) {
            const returnTo = request.originalUrl.startsWith('/') && !request.originalUrl.startsWith('//')
              ? request.originalUrl
              : '/';
            response.redirect(302, '/login?returnTo=' + encodeURIComponent(returnTo));
            return;
          }
          response.set('Cache-Control', 'no-store, private');
          response.sendFile('index.html', { root: webDistPath });
          return;
        }
        next();
      } catch (error) {
        next(error);
      }
    });
  }
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
