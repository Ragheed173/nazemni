import { basename } from 'node:path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { toNodeHandler } from 'better-auth/node';
import { pinoHttp } from 'pino-http';
import { readAuthSession, requireAuthentication, type NazemniAuth, type RegistrationMode } from './auth.js';
import { errorHandler, notFound } from './errors.js';
import { createAccountRouter, createAdminRouter, createPublicAccountRouter } from './routes/account.js';
import { entityRouter } from './routes/entities.js';
import { planningRouter } from './routes/planning.js';
import { semesterManagementRouter } from './routes/semester-management.js';
import { createAIRouter } from './routes/ai.js';
import type { AIProvider } from './ai/provider.js';
import { defaultAIRuntimeConfig, type AIRuntimeConfig } from './ai/service.js';

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
  app.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } }));
  app.use(cors({ origin: [webOrigin, ...trustedOrigins], credentials: true }));
  app.use(pinoHttp({
    redact: ['req.headers.cookie', 'req.headers.authorization', 'req.body.password', 'req.body.currentPassword', 'req.body.newPassword'],
  }));
  app.get('/health', (_request, response) => response.json({ ok: true, data: { status: 'healthy' } }));
  app.use('/api', (_request, response, next) => {
    response.set('Cache-Control', 'no-store, private');
    next();
  });
  app.get('/api/health', (_request, response) => response.json({ ok: true, data: { status: 'healthy' } }));

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
