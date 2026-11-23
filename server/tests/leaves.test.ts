import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import type { FastifyInstance } from 'fastify';

describe('Leaves API Integration Pipeline', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let employeeToken: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Acquire Admin token
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin@omnihr.com',
        password: 'password123',
      },
    });
    adminToken = adminLogin.json().accessToken;

    // Acquire Employee token (mobile client platform)
    const empLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: {
        'x-client-platform': 'mobile',
      },
      payload: {
        email: 'employee@omnihr.com',
        password: 'password123',
      },
    });
    employeeToken = empLogin.json().accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('Step 1: GET /api/leaves/balances returns leave quotas for employee', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/leaves/balances',
      headers: {
        authorization: `Bearer ${employeeToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const balances = res.json();
    expect(Array.isArray(balances)).toBe(true);
    expect(balances.length).toBeGreaterThan(0);
    expect(balances[0].leaveType).toBeDefined();
    expect(balances[0].allocatedDays).toBeDefined();
    expect(balances[0].availableDays).toBeDefined();
  });

  it('Step 2: GET /api/leaves/pending-approvals returns approvals queue', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/leaves/pending-approvals',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const pending = res.json();
    expect(Array.isArray(pending)).toBe(true);
  });

  it('Step 3: GET /api/leaves/my-requests returns personal requests', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/leaves/my-requests',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const requests = res.json();
    expect(Array.isArray(requests)).toBe(true);
  });
});
