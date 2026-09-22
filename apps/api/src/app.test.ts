import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import type { NazemniAuth } from './auth.js';
import { prisma } from './db.js';

const fakeAuth = {
  handler: async () => new Response(null, { status: 404 }),
  api: { getSession: async () => null },
} as unknown as NazemniAuth;

const adminWithoutTwoFactorAuth = {
  handler: async () => new Response(null, { status: 404 }),
  api: {
    getSession: async () => ({
      session: { id: 'admin-session', createdAt: new Date(), expiresAt: new Date(Date.now() + 60_000) },
      user: { id: 'admin-a' },
    }),
  },
} as unknown as NazemniAuth;

let webDistPath: string;
beforeAll(() => {
  webDistPath = mkdtempSync(join(tmpdir(), 'nazemni-web-'));
  writeFileSync(join(webDistPath, 'index.html'), '<!doctype html><title>Nazemni</title>');
});
afterAll(() => rmSync(webDistPath, { recursive: true, force: true }));

describe('application security boundary', () => {
  const app = () => createApp({ auth: fakeAuth, registrationMode: 'INVITE_ONLY', webDistPath });

  it('keeps health public', async () => {
    const response = await request(app()).get('/health');
    expect(response.status).toBe(200);
    const proxiedResponse = await request(app()).get('/api/health');
    expect(proxiedResponse.status).toBe(200);
    expect(proxiedResponse.headers['cache-control']).toBe('no-store, private');
  });

  it('rejects unauthenticated API requests', async () => {
    const response = await request(app()).get('/api/courses');
    expect(response.status).toBe(401);
    expect((await request(app()).get('/api/ai/status')).status).toBe(401);
  });

  it('serves the public landing and authentication pages', async () => {
    expect((await request(app()).get('/').set('Accept', 'text/html')).status).toBe(200);
    expect((await request(app()).get('/login').set('Accept', 'text/html')).status).toBe(200);
    expect((await request(app()).get('/register').set('Accept', 'text/html')).status).toBe(200);
  });

  it('redirects a direct protected frontend route to login', async () => {
    const response = await request(app()).get('/courses').set('Accept', 'text/html');
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/login?returnTo=%2Fcourses');
  });

  it('publishes invite-only registration mode without exposing secrets', async () => {
    const response = await request(app()).get('/api/public/registration');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ mode: 'INVITE_ONLY' });
  });

  it('rejects unsafe requests with a missing, foreign, or direct-Render origin', async () => {
    const target = app();
    expect((await request(target).post('/api/auth/sign-out').send({})).status).toBe(403);
    expect((await request(target).post('/api/auth/sign-out').set('Origin', 'https://evil.example').send({})).status).toBe(403);
    expect((await request(target).post('/api/auth/sign-out').set('Origin', 'https://nazemni-api.onrender.com').send({})).status).toBe(403);
    expect((await request(target).post('/api/auth/sign-out').set('Origin', 'http://localhost:5173').send({})).status).toBe(404);
  });

  it('does not trust forwarded host or protocol headers to bypass Origin checks', async () => {
    const response = await request(app())
      .post('/api/auth/sign-out')
      .set('Origin', 'https://evil.example')
      .set('X-Forwarded-Host', 'nazemni.online')
      .set('X-Forwarded-Proto', 'https')
      .send({});
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('INVALID_ORIGIN');
  });

  it('rejects spoofed forwarding headers even when Origin itself is allowed', async () => {
    const target = app();
    const spoofedHost = await request(target)
      .post('/api/auth/sign-out')
      .set('Origin', 'http://localhost:5173')
      .set('X-Forwarded-Host', 'evil.example')
      .set('X-Forwarded-Proto', 'http')
      .send({});
    expect(spoofedHost.status).toBe(403);
    expect(spoofedHost.body.error.code).toBe('INVALID_ORIGIN');

    const spoofedProtocol = await request(target)
      .post('/api/auth/sign-out')
      .set('Origin', 'http://localhost:5173')
      .set('X-Forwarded-Host', 'localhost:5173')
      .set('X-Forwarded-Proto', 'https')
      .send({});
    expect(spoofedProtocol.status).toBe(403);
    expect(spoofedProtocol.body.error.code).toBe('INVALID_ORIGIN');

    const trustedForwarding = await request(target)
      .post('/api/auth/sign-out')
      .set('Origin', 'http://localhost:5173')
      .set('X-Forwarded-Host', 'localhost:5173')
      .set('X-Forwarded-Proto', 'http')
      .send({});
    expect(trustedForwarding.status).toBe(404);
  });

  it('rejects oversized authentication bodies before Better Auth parses them', async () => {
    const response = await request(app())
      .post('/api/auth/sign-in/email')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'a@example.test', password: 'x'.repeat(70 * 1024) });
    expect(response.status).toBe(413);
    expect(response.body.error).toEqual({ code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' });
  });

  it('applies the persistent authentication limit before Better Auth', async () => {
    const cleanup = vi.spyOn(prisma.rateLimit, 'deleteMany').mockResolvedValue({ count: 0 });
    const query = vi.spyOn(prisma, '$queryRaw');
    for (let count = 1; count <= 9; count += 1) {
      query.mockResolvedValueOnce([{ count, lastRequest: BigInt(Date.now()) }]);
    }
    const audit = vi.spyOn(prisma.securityAuditLog, 'create').mockResolvedValue({} as never);
    const statuses: number[] = [];
    const target = app();
    for (let attempt = 0; attempt < 9; attempt += 1) {
      statuses.push((await request(target)
        .post('/api/auth/sign-in/email')
        .set('Origin', 'http://localhost:5173')
        .set('X-Vercel-Forwarded-For', `203.0.113.${attempt + 1}`)
        .send({ email: 'nobody@example.test', password: 'invalid-password' })).status);
    }
    expect(statuses.slice(0, 8)).toEqual(Array(8).fill(404));
    expect(statuses[8]).toBe(429);
    expect(query).toHaveBeenCalledTimes(9);
    cleanup.mockRestore();
    query.mockRestore();
    audit.mockRestore();
  });

  it('sets clickjacking, MIME, referrer, and permissions protections', async () => {
    const response = await request(app()).get('/health');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['permissions-policy']).toContain('camera=()');
    expect(response.headers['content-security-policy']).toBeUndefined();
    expect(response.headers['content-security-policy-report-only']).toContain("frame-ancestors 'none'");
  });
});

describe('mandatory administrator MFA setup boundary', () => {
  const app = () => createApp({ auth: adminWithoutTwoFactorAuth, registrationMode: 'INVITE_ONLY', webDistPath });

  it('lets an administrator reach the profile setup route before enrollment', async () => {
    const userLookup = vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'admin-a', email: 'admin@example.test', name: 'Admin', username: 'admin', role: 'ADMIN',
      status: 'ACTIVE', preferredLanguage: 'en', twoFactorEnabled: false, createdAt: new Date(),
    } as never);
    const response = await request(app()).get('/api/account/profile');
    expect(response.status).toBe(200);
    userLookup.mockRestore();
  });

  it('blocks other protected APIs until the administrator enrolls', async () => {
    const userLookup = vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'admin-a', email: 'admin@example.test', name: 'Admin', username: 'admin', role: 'ADMIN',
      status: 'ACTIVE', preferredLanguage: 'en', twoFactorEnabled: false, createdAt: new Date(),
    } as never);
    const response = await request(app()).get('/api/ai/status');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('TWO_FACTOR_SETUP_REQUIRED');
    userLookup.mockRestore();
  });
});
