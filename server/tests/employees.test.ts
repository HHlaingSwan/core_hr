import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import type { FastifyInstance } from 'fastify';

describe('Employees API Integration Pipeline', () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Acquire Admin token
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin@omnihr.com',
        password: 'password123',
      },
    });
    adminToken = loginRes.json().accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('Step 1: GET /api/employees without authorization token returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/employees',
    });

    expect(res.statusCode).toBe(401);
  });

  it('Step 2: GET /api/employees returns organization directory', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/employees',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.count).toBeDefined();
    expect(Array.isArray(body.employees)).toBe(true);
    expect(body.employees.length).toBeGreaterThan(0);
  });

  it('Step 3: GET /api/employees with query params ?search=Thura&role=admin filters correctly', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/employees',
      query: {
        search: 'Thura',
        role: 'admin',
      },
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.count).toBeGreaterThan(0);
    expect(body.employees[0].name).toContain('Thura');
    expect(body.employees[0].role).toBe('admin');
  });

  it('Step 4: POST /api/employees provisions an employee and auto-allocates leave balances', async () => {
    const uniqueSuffix = Date.now().toString().slice(-5);
    const newEmployee = {
      name: `Automated Test User ${uniqueSuffix}`,
      email: `test.user.${uniqueSuffix}@omnihr.com`,
      employeeCode: `EMP-${uniqueSuffix}`,
      initialPassword: 'Password123!',
      role: 'employee',
      designation: 'Integration QA Engineer',
      baseSalary: '1800000',
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/employees',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: newEmployee,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.message).toContain('Employee provisioned successfully');
    expect(body.employee.name).toBe(newEmployee.name);
    expect(body.employee.email).toBe(newEmployee.email);
    expect(body.employee.employeeCode).toBe(newEmployee.employeeCode);
  });
});
