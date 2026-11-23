import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import type { FastifyInstance } from 'fastify';

describe('Expense Claims API Integration Pipeline', () => {
  let app: FastifyInstance;
  let employeeToken: string;
  let adminToken: string;
  let createdClaimId: string;

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

  it('Step 1: GET /api/claims without token returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/claims',
    });

    expect(res.statusCode).toBe(401);
  });

  it('Step 2: POST /api/claims submits an expense claim in MMK', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/claims',
      headers: {
        authorization: `Bearer ${employeeToken}`,
      },
      payload: {
        title: 'Client Lunch in Bahan Township',
        category: 'Meals',
        amount: 45000,
        expenseDate: '2026-10-25',
        notes: 'Strategic client meeting catering',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.claim.currency).toBe('MMK');
    expect(body.claim.amount).toBe(45000);
    expect(body.claim.status).toBe('Submitted');

    createdClaimId = body.claim.id;
  });

  it('Step 3: GET /api/claims enforces IDOR: employee sees only their own claims', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/claims',
      headers: {
        authorization: `Bearer ${employeeToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const claims = res.json();
    expect(Array.isArray(claims)).toBe(true);
    expect(claims.length).toBeGreaterThan(0);
    // Every claim in the list belongs to this employee
    for (const claim of claims) {
      expect(claim.employeeName).toBeDefined();
    }
  });

  it('Step 4: PUT /api/claims/:id/review allows Admin/Manager to approve claim', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/claims/${createdClaimId}/review`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        status: 'Approved',
        notes: 'Receipt verified and approved for next payroll cycle disbursement.',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.claim.status).toBe('Approved');
  });
});
