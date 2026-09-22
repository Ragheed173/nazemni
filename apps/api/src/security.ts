import { createHash, randomUUID } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { AppError } from './errors.js';

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const rateLimitRetentionMs = 7 * 24 * 60 * 60_000;
let lastRateLimitCleanup = 0;

export function requireTrustedOrigin(origins: string[]): RequestHandler {
  const allowed = new Set(origins);
  const allowedHosts = new Set(origins.map((origin) => new URL(origin).host));
  const allowedProtocols = new Set(origins.map((origin) => new URL(origin).protocol.slice(0, -1)));
  return (request, _response, next) => {
    if (!unsafeMethods.has(request.method)) return next();
    const origin = request.get('origin');
    if (!origin || !allowed.has(origin)) return next(new AppError(403, 'Request origin is not allowed', 'INVALID_ORIGIN'));
    const forwardedHosts = request.get('x-forwarded-host')?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    const forwardedProtocols = request.get('x-forwarded-proto')?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    if (forwardedHosts.some((host) => !allowedHosts.has(host))
      || forwardedProtocols.some((protocol) => !allowedProtocols.has(protocol))) {
      return next(new AppError(403, 'Request origin is not allowed', 'INVALID_ORIGIN'));
    }
    next();
  };
}

export function clientIp(request: Request) {
  // Express resolves this from the trusted proxy hop configured by the app.
  // Do not read vendor-specific forwarding headers directly: the public
  // Render hostname accepts arbitrary client-supplied headers.
  return request.ip || 'unknown';
}

export function rejectOversizedRequest(maxBytes: number): RequestHandler {
  return (request, _response, next) => {
    const header = request.get('content-length');
    if (!header) return next();
    const length = Number(header);
    if (!Number.isSafeInteger(length) || length < 0 || length > maxBytes) {
      next(new AppError(413, 'Request body is too large', 'PAYLOAD_TOO_LARGE'));
      return;
    }
    next();
  };
}

async function cleanExpiredRateLimits(now: number) {
  if (now - lastRateLimitCleanup < 60 * 60_000) return;
  await prisma.rateLimit.deleteMany({
    where: { lastRequest: { lt: BigInt(now - rateLimitRetentionMs) } },
  });
  lastRateLimitCleanup = now;
}

type RateLimitOptions = {
  namespace: string;
  windowMs: number;
  limit: number;
  key?: (request: Request, response: Response) => string;
  onLimit?: () => void;
};

export function durableRateLimit(options: RateLimitOptions): RequestHandler {
  return async (request, response, next) => {
    try {
      const identity = options.key?.(request, response) ?? clientIp(request);
      const digest = createHash('sha256').update(`${options.namespace}:${identity}`).digest('hex');
      const key = `app:${options.namespace}:${digest}`;
      const now = BigInt(Date.now());
      await cleanExpiredRateLimits(Number(now));
      const cutoff = now - BigInt(options.windowMs);
      const rows = await prisma.$queryRaw<Array<{ count: number; lastRequest: bigint }>>`
        INSERT INTO "RateLimit" ("id", "key", "count", "lastRequest")
        VALUES (${randomUUID()}, ${key}, 1, ${now})
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE
            WHEN "RateLimit"."lastRequest" <= ${cutoff} THEN 1
            ELSE "RateLimit"."count" + 1
          END,
          "lastRequest" = CASE
            WHEN "RateLimit"."lastRequest" <= ${cutoff} THEN ${now}
            ELSE "RateLimit"."lastRequest"
          END
        RETURNING "count", "lastRequest"
      `;
      const row = rows[0];
      if (row && row.count > options.limit) {
        options.onLimit?.();
        const retryAfter = Math.max(1, Math.ceil((Number(row.lastRequest) + options.windowMs - Date.now()) / 1000));
        response.set('Retry-After', String(retryAfter));
        response.status(429).json({ ok: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export async function recordSecurityEvent(options: {
  event: string;
  actorUserId?: string;
  targetType?: string;
  targetId?: string;
  request?: Request;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.securityAuditLog.create({
    data: {
      event: options.event,
      actorUserId: options.actorUserId,
      targetType: options.targetType,
      targetId: options.targetId,
      ipAddress: options.request ? clientIp(options.request) : undefined,
      userAgent: options.request?.get('user-agent')?.slice(0, 500),
      metadata: options.metadata,
    },
  });
}

export function requireRecentAuthentication(maxAgeMs = 15 * 60_000): RequestHandler {
  return (_request: Request, response: Response, next: NextFunction) => {
    const session = response.locals.authSession as { createdAt?: Date | string } | undefined;
    const createdAt = session?.createdAt ? new Date(session.createdAt).getTime() : 0;
    if (!createdAt || Date.now() - createdAt > maxAgeMs) {
      next(new AppError(403, 'Please sign in again before performing this action', 'FRESH_SESSION_REQUIRED'));
      return;
    }
    next();
  };
}

const blockedPasswords = new Set([
  '1234567890', '123456789', 'password', 'password1', 'qwerty123', 'qwertyuiop',
  'letmein123', 'admin12345', 'welcome123', 'iloveyou', '0000000000', '1111111111',
]);

export function isKnownWeakPassword(password: string) {
  return blockedPasswords.has(password.toLowerCase()) || /^(.)\1{9,}$/.test(password);
}
