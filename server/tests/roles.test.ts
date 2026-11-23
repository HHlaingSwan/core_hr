import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app";
import type { FastifyInstance } from "fastify";
import { db } from "../src/db/index";
import { roles } from "../src/db/schema/permissions";
import { users } from "../src/db/schema/users";
import { eq } from "drizzle-orm";

describe("Dynamic Roles & Permissions Integration Pipeline", () => {
  let app: FastifyInstance;
  let adminToken: string;
  let managerToken: string;
  let employeeToken: string;
  let managerUserId: string;
  let customRoleId: string;
  let defaultRoleId: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // 1. Acquire Admin token
    const adminLoginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "admin@omnihr.com",
        password: "password123",
      },
    });
    adminToken = adminLoginRes.json().accessToken;

    // 2. Acquire Manager token
    const managerLoginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "manager@omnihr.com",
        password: "password123",
      },
    });
    managerToken = managerLoginRes.json().accessToken;
    managerUserId = managerLoginRes.json().user.id;

    // 3. Acquire Employee token (via mobile ESS platform header to allow employee login)
    const empLoginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: {
        "x-client-platform": "mobile",
      },
      payload: {
        email: "employee@omnihr.com",
        password: "password123",
      },
    });
    employeeToken = empLoginRes.json().accessToken;

    // 4. Ensure at least one system default role exists for testing guard logic
    const [existingDefault] = await db
      .select()
      .from(roles)
      .where(eq(roles.isSystemDefault, true))
      .limit(1);

    if (existingDefault) {
      defaultRoleId = existingDefault.id;
    } else {
      const adminUser = await db.query.users.findFirst({
        where: eq(users.email, "admin@omnihr.com"),
      });
      const [newDefault] = await db
        .insert(roles)
        .values({
          orgId: adminUser?.orgId || null,
          name: "System Default Administrator",
          description: "System standard admin role",
          isSystemDefault: true,
        })
        .returning();
      defaultRoleId = newDefault.id;
    }
  });

  afterAll(async () => {
    // Cleanup custom role if still present
    if (customRoleId) {
      await db.delete(roles).where(eq(roles.id, customRoleId));
    }
    await app.close();
  });

  it("Step 1: GET /api/permissions without authorization token returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/permissions",
    });

    expect(res.statusCode).toBe(401);
  });

  it("Step 2: GET /api/permissions returns all permissions grouped by module", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/permissions",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.count).toBeGreaterThan(0);
    expect(Array.isArray(body.permissions)).toBe(true);
    expect(body.modules).toBeDefined();

    // Verify key system modules are present and grouped
    expect(body.modules.employees).toBeDefined();
    expect(body.modules.attendance).toBeDefined();
    expect(body.modules.leaves).toBeDefined();
    expect(body.modules.claims).toBeDefined();
    expect(body.modules.roles).toBeDefined();
    expect(body.modules.employees.some((p: any) => p.code === "employees:salary:view")).toBe(true);
  });

  it("Step 3: GET /api/roles returns org roles with attached permissions and userCount", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/roles",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.roles)).toBe(true);
    expect(typeof body.count).toBe("number");

    if (body.roles.length > 0) {
      const role = body.roles[0];
      expect(role.id).toBeDefined();
      expect(role.name).toBeDefined();
      expect(Array.isArray(role.permissions)).toBe(true);
      expect(typeof role.userCount).toBe("number");
    }
  });

  it("Step 4: POST /api/roles without admin/hr authorization returns 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/roles",
      headers: {
        authorization: `Bearer ${employeeToken}`,
      },
      payload: {
        name: "Unauthorized Role Attempt",
        permissions: ["claims:view"],
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it("Step 5: POST /api/roles creates a custom role with permissions atomically", async () => {
    const rolePayload = {
      name: "Finance & Claims Reviewer",
      description: "Dedicated custom role for expense claims review and payroll view",
      permissions: ["claims:view", "claims:approve", "payroll:view"],
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/roles",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: rolePayload,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.message).toContain("successfully");
    expect(body.role).toBeDefined();
    expect(body.role.id).toBeDefined();
    expect(body.role.name).toBe(rolePayload.name);
    expect(body.role.description).toBe(rolePayload.description);
    expect(body.role.isSystemDefault).toBe(false);
    expect(body.role.permissions).toEqual(expect.arrayContaining(["claims:view", "claims:approve", "payroll:view"]));
    expect(body.role.userCount).toBe(0);

    customRoleId = body.role.id;
  });

  it("Step 6: PUT /api/roles/:id updates role details and attached permissions", async () => {
    const updatePayload = {
      name: "Senior Claims & Finance Reviewer",
      description: "Updated description with employees:view permission added",
      permissions: ["claims:view", "claims:approve", "payroll:view", "employees:view"],
    };

    const res = await app.inject({
      method: "PUT",
      url: `/api/roles/${customRoleId}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: updatePayload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.message).toContain("successfully");
    expect(body.role.name).toBe(updatePayload.name);
    expect(body.role.description).toBe(updatePayload.description);
    expect(body.role.permissions).toHaveLength(4);
    expect(body.role.permissions).toContain("employees:view");
  });

  it("Step 7: PUT /api/roles/:id guards system default roles against modification", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/roles/${defaultRoleId}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        name: "Hacked Default Role",
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("System default roles cannot be modified");
  });

  it("Step 8: DELETE /api/roles/:id guards system default roles against deletion", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/roles/${defaultRoleId}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("System default roles cannot be deleted");
  });

  it("Step 9: POST /api/employees provisions an employee with roleId and customPermissions", async () => {
    const uniqueSuffix = Date.now().toString().slice(-5);
    const newEmployeePayload = {
      name: `RBAC Staff User ${uniqueSuffix}`,
      email: `rbac.user.${uniqueSuffix}@omnihr.com`,
      employeeCode: `RBAC-${uniqueSuffix}`,
      initialPassword: "Password123!",
      role: "employee",
      roleId: customRoleId,
      customPermissions: ["leaves:approve", "attendance:view"],
      designation: "Finance Audit Associate",
      managerId: managerUserId,
      baseSalary: "2500000.00",
      allowances: "300000.00",
      bankName: "KBZ Bank",
      bankAccountNumber: "099-123-456789",
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/employees",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: newEmployeePayload,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.message).toContain("Employee provisioned successfully");
    expect(body.employee.name).toBe(newEmployeePayload.name);
    expect(body.employee.roleId).toBe(customRoleId);
    expect(body.employee.permissions).toEqual(expect.arrayContaining(["leaves:approve", "attendance:view"]));
  });

  it("Step 10: GET /api/roles reflects updated userCount after employee assignment", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/roles",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const customRole = body.roles.find((r: any) => r.id === customRoleId);
    expect(customRole).toBeDefined();
    expect(customRole.userCount).toBeGreaterThanOrEqual(1);
  });

  it("Step 11: GET /api/employees as Manager scopes strictly to subordinates and redacts salary/bank data", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/employees",
      headers: {
        authorization: `Bearer ${managerToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.employees)).toBe(true);
    expect(body.employees.length).toBeGreaterThan(0);

    // 1. Scoping Check: Every returned employee MUST report to this manager
    for (const emp of body.employees) {
      expect(emp.managerId).toBe(managerUserId);
    }

    // 2. Salary Redaction Check: baseSalary, allowances, and bank info MUST be omitted
    for (const emp of body.employees) {
      expect(emp.baseSalary).toBeUndefined();
      expect(emp.allowances).toBeUndefined();
      expect(emp.bankName).toBeUndefined();
      expect(emp.bankAccountNumber).toBeUndefined();
      expect(emp.name).toBeDefined();
      expect(emp.employeeCode).toBeDefined();
    }
  });

  it("Step 12: GET /api/employees as Admin includes sensitive salary and bank info", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/employees",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.employees.length).toBeGreaterThan(0);

    // Admin MUST see baseSalary and compensation details
    const sample = body.employees.find((e: any) => e.baseSalary !== undefined);
    expect(sample).toBeDefined();
    expect(sample.baseSalary).toBeDefined();
  });

  it("Step 13: DELETE /api/roles/:id deletes custom role and unassigns users", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/roles/${customRoleId}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toContain("successfully");

    // Verify it is no longer returned in GET /api/roles
    const checkRes = await app.inject({
      method: "GET",
      url: "/api/roles",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    const body = checkRes.json();
    expect(body.roles.some((r: any) => r.id === customRoleId)).toBe(false);

    customRoleId = ""; // Mark as cleaned up
  });
});
