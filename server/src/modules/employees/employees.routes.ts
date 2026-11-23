import { FastifyInstance, FastifyPluginAsync } from "fastify";
import bcrypt from "bcryptjs";
import { eq, and, ilike, or, sql } from "drizzle-orm";
import { db } from "../../db/index";
import { users, departments } from "../../db/schema/users";
import { leaveBalances } from "../../db/schema/leaves";
import { authenticate, authorize } from "../../middleware/auth";

export const employeesRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // 1. Get Employees Directory (Scoped to user's Organization)
  app.get<{
    Querystring: { departmentId?: string; search?: string; role?: string };
  }>("/", { preHandler: [authenticate] }, async (request, reply) => {
    const orgId = request.user.orgId;
    if (!orgId) {
      return reply.status(400).send({ message: "User is not associated with an organization" });
    }

    const { departmentId, search, role } = request.query;

    const conditions = [eq(users.orgId, orgId)];

    // If caller is 'manager', scope strictly to eq(users.managerId, callerId)
    const callerRole = request.user.role?.toLowerCase();
    if (callerRole === "manager") {
      conditions.push(eq(users.managerId, request.user.userId));
    }

    if (departmentId) {
      conditions.push(eq(users.departmentId, departmentId));
    }
    if (role) {
      conditions.push(eq(users.role, role.toLowerCase()));
    }
    if (search) {
      conditions.push(
        or(
          ilike(users.name, `%${search}%`),
          ilike(users.email, `%${search}%`),
          ilike(users.employeeCode, `%${search}%`)
        )!
      );
    }

    const employeeList = await db
      .select({
        id: users.id,
        employeeCode: users.employeeCode,
        name: users.name,
        email: users.email,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        role: users.role,
        roleId: users.roleId,
        permissions: users.permissions,
        departmentId: users.departmentId,
        departmentName: users.departmentName,
        designation: users.designation,
        managerId: users.managerId,
        managerName: users.managerName,
        employmentType: users.employmentType,
        startDate: users.startDate,
        nrcNumber: users.nrcNumber,
        ssbNumber: users.ssbNumber,
        bankName: users.bankName,
        bankAccountNumber: users.bankAccountNumber,
        baseSalary: users.baseSalary,
        allowances: users.allowances,
        active: users.active,
        version: users.version,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(...conditions));

    // Salary Access Redaction:
    // If caller does NOT have salary access (not in ['admin', 'hr', 'payroll']), strictly omit/redact baseSalary, allowances, bank details.
    const hasSalaryAccess = ["admin", "hr", "payroll"].includes(callerRole);

    const sanitizedList = employeeList.map((emp) => {
      if (!hasSalaryAccess) {
        const {
          baseSalary,
          allowances,
          bankName,
          bankAccountNumber,
          ...rest
        } = emp;
        return rest;
      }
      return emp;
    });

    return reply.send({
      count: sanitizedList.length,
      employees: sanitizedList,
    });

  });

  // 2. Provision New Employee (HR & Admin Only - Web Only)
  app.post<{
    Body: {
      name: string;
      email: string;
      employeeCode: string;
      initialPassword: string;
      role?: string;
      roleId?: string;
      customPermissions?: string[];
      permissions?: string[];
      departmentId?: string;
      branchId?: string;
      designation?: string;
      managerId?: string;
      baseSalary?: string;
      allowances?: string;
      startDate?: string;
      nrcNumber?: string;
      ssbNumber?: string;
      phone?: string;
      bankName?: string;
      bankAccountNumber?: string;
    };
  }>("/", { preHandler: [authenticate, authorize(["admin", "hr"])] }, async (request, reply) => {
    const orgId = request.user.orgId;
    if (!orgId) {
      return reply.status(400).send({ message: "Organization ID is required" });
    }

    const {
      name,
      email,
      employeeCode,
      initialPassword,
      role = "employee",
      roleId,
      customPermissions,
      permissions: reqPermissions,
      departmentId,
      branchId,
      designation,
      managerId,
      baseSalary = "0.00",
      allowances = "0.00",
      startDate,
      nrcNumber,
      ssbNumber,
      phone,
      bankName,
      bankAccountNumber,
    } = request.body || {};

    if (!name || !email || !employeeCode || !initialPassword) {
      return reply.status(400).send({
        message: "name, email, employeeCode, and initialPassword are required",
      });
    }

    // Check unique email
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return reply.status(409).send({ message: "An employee with this email already exists" });
    }

    // Resolve department name
    let resolvedDepartmentName: string | null = null;
    if (departmentId) {
      const [dept] = await db
        .select()
        .from(departments)
        .where(eq(departments.id, departmentId))
        .limit(1);
      if (dept) resolvedDepartmentName = dept.name;
    }

    // Resolve manager name
    let resolvedManagerName: string | null = null;
    if (managerId) {
      const [mgr] = await db
        .select()
        .from(users)
        .where(eq(users.id, managerId))
        .limit(1);
      if (mgr) resolvedManagerName = mgr.name;
    }

    // Hash initial password
    const passwordHash = await bcrypt.hash(initialPassword, 10);

    // Atomic employee creation & leave balance allocation via Drizzle Transaction
    const newEmployee = await db.transaction(async (tx) => {
      // 1. Insert employee
      const [emp] = await tx
        .insert(users)
        .values({
          orgId,
          isOrgAdmin: false,
          branchId: branchId || null,
          employeeCode,
          name,
          email,
          passwordHash,
          phone: phone || null,
          role: role.toLowerCase(),
          roleId: roleId || null,
          permissions: customPermissions || reqPermissions || null,
          departmentId: departmentId || null,
          departmentName: resolvedDepartmentName,
          designation: designation || "Staff",
          managerId: managerId || null,
          managerName: resolvedManagerName,
          employmentType: "Permanent",
          startDate: startDate || new Date().toISOString().split("T")[0],
          baseSalary,
          allowances,
          nrcNumber: nrcNumber || null,
          ssbNumber: ssbNumber || null,
          bankName: bankName || null,
          bankAccountNumber: bankAccountNumber || null,
          active: true,
        })
        .returning();

      // 2. Auto-allocate initial leave balances for the current calendar year
      const currentYear = new Date().getFullYear();
      await tx.insert(leaveBalances).values([
        {
          orgId,
          userId: emp.id,
          leaveType: "Annual",
          year: currentYear,
          allocatedDays: "10.00",
          usedDays: "0.00",
          pendingDays: "0.00",
          carriedOverDays: "0.00",
        },
        {
          orgId,
          userId: emp.id,
          leaveType: "Sick",
          year: currentYear,
          allocatedDays: "30.00",
          usedDays: "0.00",
          pendingDays: "0.00",
          carriedOverDays: "0.00",
        },
        {
          orgId,
          userId: emp.id,
          leaveType: "Casual",
          year: currentYear,
          allocatedDays: "6.00",
          usedDays: "0.00",
          pendingDays: "0.00",
          carriedOverDays: "0.00",
        },
        {
          orgId,
          userId: emp.id,
          leaveType: "Unpaid",
          year: currentYear,
          allocatedDays: "30.00",
          usedDays: "0.00",
          pendingDays: "0.00",
          carriedOverDays: "0.00",
        },
      ]);

      return emp;
    });

    return reply.status(201).send({
      message: "Employee provisioned successfully with standard annual leave allocations",
      employee: {
        id: newEmployee.id,
        employeeCode: newEmployee.employeeCode,
        version: newEmployee.version,
        name: newEmployee.name,
        email: newEmployee.email,
        role: newEmployee.role,
        roleId: newEmployee.roleId,
        permissions: newEmployee.permissions,
        customPermissions: newEmployee.permissions,
        department: newEmployee.departmentName,
        designation: newEmployee.designation,
        reportingManager: newEmployee.managerName,
        baseSalary: newEmployee.baseSalary,
        currency: "MMK",
        startDate: newEmployee.startDate,
      },
    });
  });


  // 3. Update Employee Profile (HR & Admin Only - With Optimistic Concurrency Control)
  app.put<{
    Params: { id: string };
    Body: {
      name?: string;
      email?: string;
      phone?: string;
      role?: string;
      roleId?: string;
      customPermissions?: string[];
      permissions?: string[];
      departmentId?: string;
      designation?: string;
      managerId?: string;
      baseSalary?: string;
      allowances?: string;
      active?: boolean;
      version?: number;
    };
  }>("/:id", { preHandler: [authenticate, authorize(["admin", "hr"])] }, async (request, reply) => {
    const { id } = request.params;
    const orgId = request.user.orgId;
    const body = request.body || {};

    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), orgId ? eq(users.orgId, orgId) : undefined))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ message: "Employee not found" });
    }

    // OCC Version Check
    if (typeof body.version === "number" && existing.version !== body.version) {
      return reply.status(409).send({
        statusCode: 409,
        error: "Conflict",
        message: "Data has been modified by another user. Please refresh the page to load the latest changes.",
        currentVersion: existing.version,
      });
    }

    let resolvedDepartmentName = existing.departmentName;
    if (body.departmentId && body.departmentId !== existing.departmentId) {
      const [dept] = await db.select().from(departments).where(eq(departments.id, body.departmentId)).limit(1);
      if (dept) resolvedDepartmentName = dept.name;
    }

    let resolvedManagerName = existing.managerName;
    if (body.managerId && body.managerId !== existing.managerId) {
      const [mgr] = await db.select().from(users).where(eq(users.id, body.managerId)).limit(1);
      if (mgr) resolvedManagerName = mgr.name;
    }

    const updateCondition =
      typeof body.version === "number"
        ? and(eq(users.id, id), eq(users.version, body.version))
        : eq(users.id, id);

    const [updated] = await db
      .update(users)
      .set({
        name: body.name ?? existing.name,
        email: body.email ?? existing.email,
        phone: body.phone ?? existing.phone,
        role: body.role ? body.role.toLowerCase() : existing.role,
        roleId: body.roleId !== undefined ? body.roleId : existing.roleId,
        permissions: body.customPermissions ?? body.permissions ?? existing.permissions,
        departmentId: body.departmentId ?? existing.departmentId,
        departmentName: resolvedDepartmentName,
        designation: body.designation ?? existing.designation,
        managerId: body.managerId ?? existing.managerId,
        managerName: resolvedManagerName,
        baseSalary: body.baseSalary ?? existing.baseSalary,
        allowances: body.allowances ?? existing.allowances,
        active: typeof body.active === "boolean" ? body.active : existing.active,
        version: sql`${users.version} + 1`,
        updatedAt: new Date(),
      })
      .where(updateCondition)
      .returning();

    if (!updated) {
      const [current] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (current) {
        return reply.status(409).send({
          statusCode: 409,
          error: "Conflict",
          message: "Data has been modified by another user. Please refresh the page to load the latest changes.",
          currentVersion: current.version,
        });
      }
      return reply.status(404).send({ message: "Employee not found" });
    }

    return reply.send({
      message: "Employee updated successfully",
      employee: {
        id: updated.id,
        employeeCode: updated.employeeCode,
        version: updated.version,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        roleId: updated.roleId,
        permissions: updated.permissions,
        customPermissions: updated.permissions,
        department: updated.departmentName,
        designation: updated.designation,
        reportingManager: updated.managerName,
        baseSalary: updated.baseSalary,
        currency: "MMK",
        active: updated.active,
      },
    });
  });
};
