import { FastifyInstance, FastifyPluginAsync } from "fastify";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/index";
import { organizations } from "../../db/schema/organizations";
import { users, departments, refreshTokens } from "../../db/schema/users";
import { officeLocations } from "../../db/schema/attendance";
import { authenticate, authorize } from "../../middleware/auth";

export const platformRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // All platform routes require authentication and 'superadmin' role
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", authorize(["superadmin"]));

  // 1. Get Platform Metrics Overview
  app.get("/metrics", async (_request, reply) => {
    const [orgStats] = await db
      .select({
        totalOrgs: sql<number>`count(*)::int`,
        activeOrgs: sql<number>`count(case when ${organizations.status} = 'active' then 1 end)::int`,
        suspendedOrgs: sql<number>`count(case when ${organizations.status} = 'suspended' then 1 end)::int`,
      })
      .from(organizations);

    const [userStats] = await db
      .select({
        totalUsers: sql<number>`count(*)::int`,
        activeUsers: sql<number>`count(case when ${users.active} = true then 1 end)::int`,
      })
      .from(users);

    return reply.send({
      totalOrganizations: orgStats?.totalOrgs || 0,
      activeOrganizations: orgStats?.activeOrgs || 0,
      suspendedOrganizations: orgStats?.suspendedOrgs || 0,
      totalUsers: userStats?.totalUsers || 0,
      activeUsers: userStats?.activeUsers || 0,
    });
  });

  // 2. List All Organizations (Tenants)
  app.get("/organizations", async (_request, reply) => {
    const orgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        code: organizations.code,
        currency: organizations.currency,
        status: organizations.status,
        plan: organizations.plan,
        maxEmployees: organizations.maxEmployees,
        taxId: organizations.taxId,
        phone: organizations.phone,
        address: organizations.address,
        version: organizations.version,
        createdAt: organizations.createdAt,
        userCount: sql<number>`count(${users.id})::int`,
      })
      .from(organizations)
      .leftJoin(users, eq(users.orgId, organizations.id))
      .groupBy(organizations.id)
      .orderBy(sql`${organizations.createdAt} desc`);

    return reply.send({ organizations: orgs });
  });

  // 3. Register / Create a New Organization (SuperAdmin Provisioning)
  app.post<{
    Body: {
      orgName: string;
      orgCode: string;
      adminName: string;
      adminEmail: string;
      adminPassword?: string;
      plan?: string;
      maxEmployees?: number;
      taxId?: string;
      phone?: string;
      address?: string;
      officeName?: string;
      officeLat?: string;
      officeLng?: string;
      officeRadius?: number;
    };
  }>("/organizations", async (request, reply) => {
    const {
      orgName,
      orgCode,
      adminName,
      adminEmail,
      adminPassword = "Password123!",
      plan = "standard",
      maxEmployees = 50,
      taxId,
      phone,
      address,
      officeName,
      officeLat,
      officeLng,
      officeRadius,
    } = request.body || {};

    if (!orgName || !orgCode || !adminName || !adminEmail) {
      return reply.status(400).send({
        message: "orgName, orgCode, adminName, and adminEmail are required",
      });
    }

    // Check unique email and org code
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1);

    if (existingUser) {
      return reply.status(409).send({ message: "An account with this admin email already exists" });
    }

    const [existingOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.code, orgCode.toUpperCase()))
      .limit(1);

    if (existingOrg) {
      return reply.status(409).send({ message: "An organization with this code already exists" });
    }

    // Atomic tenant provisioning via Drizzle Transaction
    const { org, adminUser, tempPassword } = await db.transaction(async (tx) => {
      // 1. Create Organization
      const [newOrg] = await tx
        .insert(organizations)
        .values({
          name: orgName,
          code: orgCode.toUpperCase(),
          currency: "MMK",
          status: "active",
          plan,
          maxEmployees,
          taxId: taxId || null,
          phone: phone || null,
          address: address || null,
        })
        .returning();

      // 2. Create Default Departments
      const [newExecDept] = await tx
        .insert(departments)
        .values({
          orgId: newOrg.id,
          name: "Executive Management",
          code: "EXEC",
        })
        .returning();

      await tx.insert(departments).values([
        { orgId: newOrg.id, name: "Human Resources", code: "HR" },
        { orgId: newOrg.id, name: "Finance & Payroll", code: "FIN" },
        { orgId: newOrg.id, name: "Operations", code: "OPS" },
      ]);

      // 3. Create Head Office Location
      const [newHqOffice] = await tx
        .insert(officeLocations)
        .values({
          orgId: newOrg.id,
          name: officeName || `${orgName} - Head Office`,
          code: `${newOrg.code}-HQ`,
          latitude: officeLat || "16.8409000",
          longitude: officeLng || "96.1735000",
          radiusMeters: officeRadius || 300,
          address: address || "Yangon, Myanmar",
          isActive: true,
        })
        .returning();

      // 4. Create Tenant Org Admin User with Auto-Generated Temporary Password
      const tempPassword =
        adminPassword && adminPassword !== "Password123!"
          ? adminPassword
          : `Omni#${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      const [newAdminUser] = await tx
        .insert(users)
        .values({
          orgId: newOrg.id,
          isOrgAdmin: true,
          branchId: newHqOffice.id,
          employeeCode: `${newOrg.code}-0001`,
          name: adminName,
          email: adminEmail,
          passwordHash,
          phone: phone || null,
          role: "admin", // Tenant Org Admin
          departmentId: newExecDept.id,
          departmentName: newExecDept.name,
          designation: "Managing Director / Tenant Admin",
          employmentType: "Permanent",
          active: true,
          mustChangePassword: true,
          tempPassword,
          permissions: [
            "broadcastAnnouncement",
            "reviewClaim",
            "payrollClaim",
            "manageEmployeeData",
            "manageShifts",
            "submitLeave",
            "viewOwnLeave",
            "cancelOwnLeave",
            "viewTeamLeave",
            "approveManagerLeave",
            "rejectManagerLeave",
            "verifyHrLeave",
            "returnHrLeave",
            "sendToPayrollLeave",
            "viewPayrollQueue",
            "processPayrollLeave",
            "completePayrollLeave",
            "adminOverrideLeave",
          ],
        })
        .returning();

      return { org: newOrg, adminUser: newAdminUser, tempPassword };
    });

    return reply.status(201).send({
      message: "Organization registered successfully",
      organization: org,
      adminUser: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        employeeCode: adminUser.employeeCode,
        tempPassword,
        mustChangePassword: true,
      },
    });
  });

  // 4. Update Organization Status (Suspend / Reactivate)
  app.patch<{
    Params: { id: string };
    Body: { status: "active" | "suspended" | "trial"; version?: number };
  }>("/organizations/:id/status", async (request, reply) => {
    const { id } = request.params;
    const { status, version } = request.body || {};

    if (!status || !["active", "suspended", "trial"].includes(status)) {
      return reply.status(400).send({ message: "Valid status ('active', 'suspended', 'trial') is required" });
    }

    const [existing] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ message: "Organization not found" });
    }

    // OCC Check
    if (typeof version === "number" && existing.version !== version) {
      return reply.status(409).send({
        statusCode: 409,
        error: "Conflict",
        message: "Data has been modified by another user. Please refresh the page to load the latest changes.",
        currentVersion: existing.version,
      });
    }

    const updateCondition =
      typeof version === "number"
        ? and(eq(organizations.id, id), eq(organizations.version, version))
        : eq(organizations.id, id);

    const [updated] = await db
      .update(organizations)
      .set({
        status,
        version: sql`${organizations.version} + 1`,
        updatedAt: new Date(),
      })
      .where(updateCondition)
      .returning();

    if (!updated) {
      const [current] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
      if (current) {
        return reply.status(409).send({
          statusCode: 409,
          error: "Conflict",
          message: "Data has been modified by another user. Please refresh the page to load the latest changes.",
          currentVersion: current.version,
        });
      }
      return reply.status(404).send({ message: "Organization not found" });
    }

    // If suspending, invalidate all refresh tokens of users in this organization
    if (status === "suspended") {
      const orgUsers = await db.select({ id: users.id }).from(users).where(eq(users.orgId, id));
      for (const u of orgUsers) {
        await db.delete(refreshTokens).where(eq(refreshTokens.userId, u.id));
      }
    }

    return reply.send({
      message: `Organization status updated to ${status}`,
      organization: updated,
    });
  });

  // 5. Update Organization Plan & Seat Quota
  app.patch<{
    Params: { id: string };
    Body: { plan: "starter" | "standard" | "enterprise"; maxEmployees?: number; version?: number };
  }>("/organizations/:id/plan", async (request, reply) => {
    const { id } = request.params;
    const { plan, maxEmployees, version } = request.body || {};

    if (!plan || !["starter", "standard", "enterprise"].includes(plan)) {
      return reply.status(400).send({ message: "Valid plan ('starter', 'standard', 'enterprise') is required" });
    }

    const [existing] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ message: "Organization not found" });
    }

    // OCC Check
    if (typeof version === "number" && existing.version !== version) {
      return reply.status(409).send({
        statusCode: 409,
        error: "Conflict",
        message: "Data has been modified by another user. Please refresh the page to load the latest changes.",
        currentVersion: existing.version,
      });
    }

    const defaultSeats: Record<string, number> = {
      starter: 25,
      standard: 50,
      enterprise: 250,
    };

    const seats = typeof maxEmployees === "number" && maxEmployees > 0 ? maxEmployees : defaultSeats[plan];

    const updateCondition =
      typeof version === "number"
        ? and(eq(organizations.id, id), eq(organizations.version, version))
        : eq(organizations.id, id);

    const [updated] = await db
      .update(organizations)
      .set({
        plan,
        maxEmployees: seats,
        version: sql`${organizations.version} + 1`,
        updatedAt: new Date(),
      })
      .where(updateCondition)
      .returning();

    if (!updated) {
      const [current] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
      if (current) {
        return reply.status(409).send({
          statusCode: 409,
          error: "Conflict",
          message: "Data has been modified by another user. Please refresh the page to load the latest changes.",
          currentVersion: current.version,
        });
      }
      return reply.status(404).send({ message: "Organization not found" });
    }

    return reply.send({
      message: `Organization plan upgraded to ${plan} with ${seats} seats limit`,
      organization: updated,
    });
  });

  // 6. Emergency Tenant Admin Password Reset
  app.post<{
    Params: { id: string };
    Body: { customPassword?: string };
  }>("/organizations/:id/reset-admin-password", async (request, reply) => {
    const { id } = request.params;
    const { customPassword } = request.body || {};

    // Find the primary tenant admin for this organization
    const [adminUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.orgId, id), eq(users.isOrgAdmin, true)))
      .limit(1);

    if (!adminUser) {
      return reply.status(404).send({ message: "No primary organization administrator found for this tenant" });
    }

    // Generate secure temporary password or use custom
    const temporaryPassword =
      customPassword && customPassword.length >= 8
        ? customPassword
        : `OMNI-${crypto.randomBytes(4).toString("hex").toUpperCase()}!`;

    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    await db
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: true,
        tempPassword: temporaryPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, adminUser.id));

    // Invalidate prior refresh tokens of this admin user
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, adminUser.id));

    return reply.send({
      message: "Organization administrator password successfully reset",
      adminUser: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        employeeCode: adminUser.employeeCode,
      },
      temporaryPassword,
    });
  });

  // 7. Get Platform Audit Logs (Cross-Tenant Security & Governance)
  app.get("/audit-logs", async (_request, reply) => {
    // Generate synthesized platform audit trail from recent organization events
    const recentOrgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        code: organizations.code,
        status: organizations.status,
        plan: organizations.plan,
        maxEmployees: organizations.maxEmployees,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
      })
      .from(organizations)
      .orderBy(sql`${organizations.createdAt} desc`)
      .limit(20);

    const logs = recentOrgs.map((org) => ({
      id: `audit-${org.id.slice(0, 8)}`,
      timestamp: org.createdAt.toISOString(),
      eventType: "tenant_registered",
      targetOrgName: org.name,
      targetOrgCode: org.code,
      actorEmail: "superadmin@omnihr.com",
      details: `Registered tenant with ${org.plan.toUpperCase()} tier (${org.maxEmployees} seats quota)`,
    }));

    return reply.send({ auditLogs: logs });
  });
};
