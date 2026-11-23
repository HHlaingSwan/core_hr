import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { eq, and, or, inArray, sql } from "drizzle-orm";
import { db } from "../../db/index";
import { roles, rolePermissions, permissions } from "../../db/schema/permissions";
import { users } from "../../db/schema/users";
import { authenticate, authorize } from "../../middleware/auth";

export const DEFAULT_PERMISSIONS = [
  // Employees module
  { code: "employees:view", name: "View Employees", description: "View employee profiles and organizational directory", module: "employees" },
  { code: "employees:manage", name: "Manage Employees", description: "Create and update employee profile details", module: "employees" },
  { code: "employees:salary:view", name: "View Salary & Compensation", description: "Access sensitive base salary, allowances, and bank information", module: "employees" },
  
  // Attendance module
  { code: "attendance:view", name: "View Attendance", description: "View daily logs, shift assignments, and branch locations", module: "attendance" },
  { code: "attendance:punch", name: "Clock In/Out", description: "Record daily punches via geofenced mobile app or kiosk", module: "attendance" },
  { code: "attendance:manage", name: "Regularize Attendance", description: "Submit attendance regularization and correction requests", module: "attendance" },
  { code: "attendance:approve", name: "Approve Attendance", description: "Review and approve subordinate regularization requests", module: "attendance" },
  
  // Leaves module
  { code: "leaves:view", name: "View Leaves", description: "View personal and team leave quotas and histories", module: "leaves" },
  { code: "leaves:apply", name: "Apply Leave", description: "Submit leave applications and upload doctor certificates", module: "leaves" },
  { code: "leaves:approve", name: "Approve Leaves", description: "Review, approve, or reject team leave applications", module: "leaves" },
  
  // Payroll module
  { code: "payroll:view", name: "View Payslips", description: "View personal payslips and tax deduction summaries", module: "payroll" },
  { code: "payroll:process", name: "Execute Pay Run", description: "Generate monthly pay runs, bonuses, and SSB compliance", module: "payroll" },
  
  // Expense Claims module
  { code: "claims:view", name: "View Claims", description: "View expense reimbursement submissions and receipts", module: "claims" },
  { code: "claims:submit", name: "Submit Claim", description: "File expense receipts for company reimbursement", module: "claims" },
  { code: "claims:approve", name: "Approve Claims", description: "Review and approve employee expense claims", module: "claims" },
  
  // Roles & Permissions module
  { code: "roles:view", name: "View Roles", description: "View company security roles and permission matrix", module: "roles" },
  { code: "roles:manage", name: "Manage Roles", description: "Create, edit, and delete custom security roles", module: "roles" },
  
  // Announcements module
  { code: "announcements:view", name: "View Announcements", description: "Read published directives and acknowledgment notices", module: "announcements" },
  { code: "announcements:manage", name: "Publish Announcements", description: "Compose and broadcast organizational directives", module: "announcements" },
];

export const rolesRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Ensure default system permissions exist
  const seedDefaultPermissions = async () => {
    try {
      for (const p of DEFAULT_PERMISSIONS) {
        await db
          .insert(permissions)
          .values({
            code: p.code,
            name: p.name,
            description: p.description,
            module: p.module,
          })
          .onConflictDoNothing();
      }
    } catch {
      // Ignore if table doesn't exist yet or already populated
    }
  };

  // 1. GET /api/permissions (returns all permissions grouped by module)
  const getPermissionsHandler = async (_request: any, reply: any) => {
    await seedDefaultPermissions();

    const allPerms = await db
      .select()
      .from(permissions)
      .orderBy(permissions.module, permissions.code);

    const grouped: Record<string, typeof allPerms> = {};
    for (const p of allPerms) {
      if (!grouped[p.module]) {
        grouped[p.module] = [];
      }
      grouped[p.module].push(p);
    }

    return reply.send({
      count: allPerms.length,
      permissions: allPerms,
      modules: grouped,
      grouped,
    });
  };

  app.get("/permissions", { preHandler: [authenticate] }, getPermissionsHandler);
  app.get("/roles/permissions", { preHandler: [authenticate] }, getPermissionsHandler);

  // 2. GET /api/roles (returns org roles with attached permissions and userCount)
  app.get("/roles", { preHandler: [authenticate] }, async (request, reply) => {
    const orgId = request.user.orgId;
    if (!orgId) {
      return reply.status(400).send({ message: "Organization ID is required" });
    }

    // SQL Aggregation First: count users grouped by role_id
    const userCounts = await db
      .select({
        roleId: users.roleId,
        count: sql<number>`count(${users.id})::int`,
      })
      .from(users)
      .where(eq(users.orgId, orgId))
      .groupBy(users.roleId);

    const countMap = new Map<string, number>();
    for (const uc of userCounts) {
      if (uc.roleId) {
        countMap.set(uc.roleId, uc.count);
      }
    }

    // Fetch organization roles and system default roles
    const orgRoles = await db
      .select()
      .from(roles)
      .where(or(eq(roles.orgId, orgId), eq(roles.isSystemDefault, true)))
      .orderBy(roles.isSystemDefault, roles.name);

    const roleIds = orgRoles.map((r) => r.id);
    const allRolePerms =
      roleIds.length > 0
        ? await db
            .select()
            .from(rolePermissions)
            .where(inArray(rolePermissions.roleId, roleIds))
        : [];

    const rolesWithDetails = orgRoles.map((r) => {
      const perms = allRolePerms
        .filter((rp) => rp.roleId === r.id)
        .map((rp) => rp.permissionCode);
      return {
        id: r.id,
        orgId: r.orgId,
        name: r.name,
        description: r.description,
        isSystemDefault: r.isSystemDefault,
        permissions: perms,
        userCount: countMap.get(r.id) || 0,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });

    return reply.send({
      count: rolesWithDetails.length,
      roles: rolesWithDetails,
    });
  });

  // 3. POST /api/roles (atomic db.transaction inserting role and rolePermissions)
  app.post<{
    Body: {
      name: string;
      description?: string;
      permissions?: string[];
    };
  }>("/roles", { preHandler: [authenticate, authorize(["admin"])] }, async (request, reply) => {
    const orgId = request.user.orgId;
    if (!orgId) {
      return reply.status(400).send({ message: "Organization ID is required" });
    }

    const { name, description, permissions: reqPermissions = [] } = request.body || {};

    if (!name || !name.trim()) {
      return reply.status(400).send({ message: "Role name is required" });
    }

    // Atomic Multi-Table Mutation via Drizzle Transaction
    const newRoleWithPerms = await db.transaction(async (tx) => {
      const [newRole] = await tx
        .insert(roles)
        .values({
          orgId,
          name: name.trim(),
          description: description ? description.trim() : null,
          isSystemDefault: false,
        })
        .returning();

      if (Array.isArray(reqPermissions) && reqPermissions.length > 0) {
        await tx.insert(rolePermissions).values(
          reqPermissions.map((code: string) => ({
            roleId: newRole.id,
            permissionCode: code,
          }))
        );
      }

      return {
        ...newRole,
        permissions: reqPermissions,
        userCount: 0,
      };
    });

    return reply.status(201).send({
      message: "Role created successfully",
      role: newRoleWithPerms,
    });
  });

  // 4. PUT /api/roles/:id (atomic update)
  app.put<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string;
      permissions?: string[];
    };
  }>("/roles/:id", { preHandler: [authenticate, authorize(["admin"])] }, async (request, reply) => {
    const { id } = request.params;
    const orgId = request.user.orgId;
    if (!orgId) {
      return reply.status(400).send({ message: "Organization ID is required" });
    }

    const { name, description, permissions: reqPermissions } = request.body || {};

    // Object-Level Authorization: verify role belongs to organization
    const [existing] = await db
      .select()
      .from(roles)
      .where(and(eq(roles.id, id), eq(roles.orgId, orgId)))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ message: "Role not found or access denied" });
    }

    if (existing.isSystemDefault) {
      return reply.status(400).send({ message: "System default roles cannot be modified" });
    }

    // Atomic update in transaction
    const updatedRole = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(roles)
        .set({
          name: name ? name.trim() : existing.name,
          description: typeof description === "string" ? description.trim() : existing.description,
          updatedAt: new Date(),
        })
        .where(eq(roles.id, id))
        .returning();

      if (Array.isArray(reqPermissions)) {
        await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
        if (reqPermissions.length > 0) {
          await tx.insert(rolePermissions).values(
            reqPermissions.map((code: string) => ({
              roleId: id,
              permissionCode: code,
            }))
          );
        }
      }

      const assignedPerms = await tx
        .select({ code: rolePermissions.permissionCode })
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, id));

      return {
        ...updated,
        permissions: assignedPerms.map((p) => p.code),
      };
    });

    return reply.send({
      message: "Role updated successfully",
      role: updatedRole,
    });
  });

  // 5. DELETE /api/roles/:id (delete custom role; guard default roles)
  app.delete<{
    Params: { id: string };
  }>("/roles/:id", { preHandler: [authenticate, authorize(["admin"])] }, async (request, reply) => {
    const { id } = request.params;
    const orgId = request.user.orgId;
    if (!orgId) {
      return reply.status(400).send({ message: "Organization ID is required" });
    }

    const [existing] = await db
      .select()
      .from(roles)
      .where(and(eq(roles.id, id), eq(roles.orgId, orgId)))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ message: "Role not found or access denied" });
    }

    if (existing.isSystemDefault) {
      return reply.status(400).send({ message: "System default roles cannot be deleted" });
    }

    await db.transaction(async (tx) => {
      // Nullify roleId on any users assigned this role
      await tx
        .update(users)
        .set({ roleId: null })
        .where(eq(users.roleId, id));

      // Cascade will remove role_permissions, then delete role
      await tx.delete(roles).where(eq(roles.id, id));
    });

    return reply.send({
      message: "Role deleted successfully",
      roleId: id,
    });
  });
};
