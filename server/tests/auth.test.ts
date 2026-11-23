import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import type { FastifyInstance } from 'fastify';

describe('Authentication & Security Integration Tests', () => {
  let app: FastifyInstance;
  let adminAccessToken: string;
  let adminRefreshToken: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Step 1: POST /api/auth/login without email returns 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain('Email is required');
  });

  it('Step 2: POST /api/auth/login with wrong password returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin@omnihr.com',
        password: 'wrongpassword-xyz',
      },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().message).toContain('Invalid email or password');
  });

  it('Step 3: POST /api/auth/login as Admin returns 200 with tokens', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin@omnihr.com',
        password: 'password123',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.user.email).toBe('admin@omnihr.com');
    expect(body.user.role).toBe('Admin');

    adminAccessToken = body.accessToken;
    adminRefreshToken = body.refreshToken;
  });

  it('Step 4: POST /api/auth/login as Employee from Web is intercepted with 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: {
        'x-client-platform': 'web',
      },
      payload: {
        email: 'employee@omnihr.com',
        password: 'password123',
        client: 'web',
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.message).toContain('Web dashboard access is restricted');
  });

  it('Step 5: POST /api/auth/refresh rotates tokens with SHA-256 verification', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: {
        refreshToken: adminRefreshToken,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
  });

  it('Step 6: GET /api/auth/me without token returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    expect(res.statusCode).toBe(401);
  });

  it('Step 7: GET /api/auth/me with Bearer token returns profile DTO', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.email).toBe('admin@omnihr.com');
    expect(body.role).toBe('Admin');
  });
});
