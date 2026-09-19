import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import type { NazemniAuth } from './auth.js';

const fakeAuth = {
  handler: async () => new Response(null, { status: 404 }),
  api: { getSession: async () => null },
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
});
