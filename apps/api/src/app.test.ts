import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

describe('API foundation', () => {
  it('returns a consistent health response', async () => {
    const response = await request(createApp()).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, data: { status: 'healthy' } });
  });

  it('returns a consistent not-found response', async () => {
    const response = await request(createApp()).get('/missing');
    expect(response.status).toBe(404);
    expect(response.body.ok).toBe(false);
  });
});
