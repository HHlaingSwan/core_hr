import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import type { FastifyInstance } from 'fastify';

describe('Announcements API Integration Pipeline', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let firstAnnouncementId: string;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('Step 1: GET /api/announcements returns published company directives', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/announcements',
    });

    expect(res.statusCode).toBe(200);
    const announcements = res.json();
    expect(Array.isArray(announcements)).toBe(true);
    if (announcements.length > 0) {
      expect(announcements[0].title).toBeDefined();
      expect(announcements[0].directiveNo).toBeDefined();
      expect(announcements[0].priority).toBeDefined();
      firstAnnouncementId = announcements[0].id;
    }
  });

  it('Step 2: POST /api/announcements/:id/read records user read receipt', async () => {
    if (!firstAnnouncementId) return;

    const res = await app.inject({
      method: 'POST',
      url: `/api/announcements/${firstAnnouncementId}/read`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toContain('marked as read');
  });

  it('Step 3: POST /api/announcements/:id/read without token rejects with 401', async () => {
    if (!firstAnnouncementId) return;

    const res = await app.inject({
      method: 'POST',
      url: `/api/announcements/${firstAnnouncementId}/read`,
    });

    expect(res.statusCode).toBe(401);
  });
});
