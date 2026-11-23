import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import type { FastifyInstance } from 'fastify';

describe('Attendance API Integration Pipeline', () => {
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

  it('Step 1: GET /api/attendance/branches returns active geofence locations', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/attendance/branches',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const branches = res.json();
    expect(Array.isArray(branches)).toBe(true);
    expect(branches.length).toBeGreaterThan(0);
    expect(branches[0].latitude).toBeDefined();
    expect(branches[0].longitude).toBeDefined();
    expect(branches[0].radiusMeters).toBeDefined();
  });

  it('Step 2: GET /api/attendance/summary executes SQL aggregations and returns attendance stats', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/attendance/summary',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const summary = res.json();
    expect(summary.totalWorkingDays).toBeDefined();
    expect(summary.presentDays).toBeDefined();
    expect(summary.lateDays).toBeDefined();
    expect(summary.absentDays).toBeDefined();
    expect(summary.totalWorkHours).toBeDefined();
    expect(['NotCheckedIn', 'CheckedIn', 'CheckedOut']).toContain(summary.currentStatus);
  });

  let createdRegularizationId: string;
  const testDate = '2026-03-15';

  it('Step 3: POST /api/attendance/regularize fails with 400 when date or reason is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/attendance/regularize',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        date: testDate,
        // reason missing
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain('Date and reason are required');
  });

  it('Step 4: POST /api/attendance/regularize successfully creates a pending request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/attendance/regularize',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        date: testDate,
        requestedClockIn: '09:00:00',
        requestedClockOut: '17:30:00',
        reason: 'Client meeting at offsite facility with poor connectivity',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.status).toBe('pending');
    expect(body.date).toBe(testDate);
    expect(body.requestedClockIn).toBe('09:00:00');
    expect(body.requestedClockOut).toBe('17:30:00');
    createdRegularizationId = body.id;
  });

  it('Step 5: GET /api/attendance/regularize/my-requests returns submitted request', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/attendance/regularize/my-requests',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const requests = res.json();
    expect(Array.isArray(requests)).toBe(true);
    const found = requests.find((r: any) => r.id === createdRegularizationId);
    expect(found).toBeDefined();
    expect(found.reason).toContain('Client meeting at offsite facility');
  });

  it('Step 6: GET /api/attendance/regularize/pending lists pending requests for reviewers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/attendance/regularize/pending',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const list = res.json();
    expect(Array.isArray(list)).toBe(true);
    const found = list.find((r: any) => r.id === createdRegularizationId);
    expect(found).toBeDefined();
    expect(found.employeeName).toBeDefined();
  });

  it('Step 7: PUT /api/attendance/regularize/:id/review approves request and regularizes attendance record', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/attendance/regularize/${createdRegularizationId}/review`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        status: 'approved',
        comment: 'Verified with client offsite log. Approved.',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.message).toContain('approved');
    expect(body.regularization.status).toBe('approved');
    expect(body.regularization.approverComment).toContain('Verified with client');
  });

  it('Step 8: POST /api/attendance/proxy-punch fails with 400 when required fields are missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/attendance/proxy-punch',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        // missing targetUserId and branchId
        punchType: 'check_in',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain('required');
  });

  it('Step 9: POST /api/attendance/proxy-punch records check-in on behalf of employee at specific branch', async () => {
    // 1. Get branches to select a valid branch
    const branchRes = await app.inject({
      method: 'GET',
      url: '/api/attendance/branches',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });
    const branches = branchRes.json();
    expect(branches.length).toBeGreaterThan(0);
    const selectedBranch = branches[0];

    // 2. Get an employee
    const empRes = await app.inject({
      method: 'GET',
      url: '/api/employees',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });
    const employees = empRes.json().employees;
    expect(employees.length).toBeGreaterThan(0);
    const targetEmp = employees[0];

    // 3. Perform proxy punch
    const punchRes = await app.inject({
      method: 'POST',
      url: '/api/attendance/proxy-punch',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        targetUserId: targetEmp.id,
        branchId: selectedBranch.id,
        punchType: 'check_in',
        reason: 'Lost phone / connectivity failure',
        note: 'Manager confirmed presence at Office 2 branch',
        timestamp: '09:00:00',
      },
    });

    expect(punchRes.statusCode).toBe(200);
    const body = punchRes.json();
    expect(body.message).toContain('check-in');
    expect(body.attendanceRecord).toBeDefined();
    expect(body.attendanceRecord.locationName).toBe(selectedBranch.name);
    expect(body.attendanceRecord.isRegularized).toBe(true);
    expect(body.punch.branchId).toBe(selectedBranch.id);
  });
});
