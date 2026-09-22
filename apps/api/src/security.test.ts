import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from './db.js';
import { errorHandler } from './errors.js';
import { clientIp, durableRateLimit } from './security.js';

describe('durable application rate limiting', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('uses persisted database counts across middleware instances', async () => {
    vi.spyOn(prisma.rateLimit, 'deleteMany').mockResolvedValue({ count: 0 });
    const query = vi.spyOn(prisma, '$queryRaw')
      .mockResolvedValueOnce([{ count: 1, lastRequest: BigInt(Date.now()) }])
      .mockResolvedValueOnce([{ count: 2, lastRequest: BigInt(Date.now()) }]);

    const makeApp = () => {
      const app = express();
      app.use(durableRateLimit({ namespace: 'restart-test', windowMs: 60_000, limit: 1 }));
      app.get('/', (_request, response) => response.json({ ok: true }));
      app.use(errorHandler);
      return app;
    };

    expect((await request(makeApp()).get('/')).status).toBe(200);
    const limited = await request(makeApp()).get('/');
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
    expect(limited.body.error.code).toBe('RATE_LIMITED');
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('does not trust vendor-specific client IP headers directly', async () => {
    const seen: string[] = [];
    const app = express();
    app.set('trust proxy', 1);
    app.get('/', (request, response) => {
      seen.push(clientIp(request));
      response.json({ ok: true });
    });

    await request(app)
      .get('/')
      .set('X-Vercel-Forwarded-For', '203.0.113.250')
      .set('CF-Connecting-IP', '203.0.113.251');

    expect(seen).toHaveLength(1);
    expect(seen[0]).not.toBe('203.0.113.250');
    expect(seen[0]).not.toBe('203.0.113.251');
  });
});
