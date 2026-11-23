import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import type { FastifyInstance } from 'fastify';

describe('Payroll API & Object-Level Authorization (IDOR) Integration Pipeline', () => {
  let app: FastifyInstance;
  let employeeToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('Step 1: GET /api/payroll/payslips returns user payslips in MMK currency', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/payroll/payslips',
      headers: {
        authorization: `Bearer ${employeeToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const slips = res.json();
    expect(Array.isArray(slips)).toBe(true);
    if (slips.length > 0) {
      expect(slips[0].currency).toBe('MMK');
      expect(slips[0].grossEarnings).toBeDefined();
      expect(slips[0].netPay).toBeDefined();
    }
  });

  it('Step 2: GET /api/payroll/payslips/:id blocks non-existent or foreign payslip access', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/payroll/payslips/00000000-0000-0000-0000-000000000099',
      headers: {
        authorization: `Bearer ${employeeToken}`,
      },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().message).toContain('access denied');
  });

  it('Step 3: GET /api/payroll/payslips without token rejects with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/payroll/payslips',
    });

    expect(res.statusCode).toBe(401);
  });
});
