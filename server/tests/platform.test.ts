import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import type { FastifyInstance } from 'fastify';

describe('Platform SuperAdmin Multi-Tenant Hub Integration Pipeline', () => {
  let app: FastifyInstance;
  let superadminToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Acquire SuperAdmin token
    const superLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'superadmin@omnihr.com',
        password: 'password123',
      },
    });
    superadminToken = superLogin.json().accessToken;

    // Acquire regular Admin token (not superadmin)
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin@omnihr.com',
        password: 'password123',
      },
    });
    adminToken = adminLogin.json().accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('Step 1: GET /api/platform/metrics blocks non-superadmin users with 403 Forbidden', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/platform/metrics',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('Step 2: GET /api/platform/metrics allows SuperAdmin and returns overview stats', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/platform/metrics',
      headers: {
        authorization: `Bearer ${superadminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const metrics = res.json();
    expect(metrics.totalOrganizations).toBeDefined();
    expect(metrics.activeOrganizations).toBeDefined();
    expect(metrics.totalUsers).toBeDefined();
  });

  it('Step 3: GET /api/platform/organizations lists all tenant companies', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/platform/organizations',
      headers: {
        authorization: `Bearer ${superadminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.organizations)).toBe(true);
    expect(body.organizations.length).toBeGreaterThan(0);
    expect(body.organizations[0].code).toBeDefined();
    expect(body.organizations[0].name).toBeDefined();
  });
});
