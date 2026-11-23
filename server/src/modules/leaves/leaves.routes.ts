import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { eq, and, desc, ne, sql } from "drizzle-orm";
import { db } from "../../db/index";
import { leaveBalances, leaveRequests, leaveAuditLogs, publicHolidays } from "../../db/schema/leaves";
import { users } from "../../db/schema/users";
import { authenticate, authorize } from "../../middleware/auth";

// Exclude Saturdays, Sundays, and Myanmar Gazette Public Holidays from leave deduction
function calculateWorkingDays(
  startDateStr: string,
  endDateStr: string,
  holidayDates: Set<string>
): number {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  let workingDays = 0;

  const cur = new Date(start);
  while (cur <= end) {
    const dayOfWeek = cur.getDay(); // 0 = Sun, 6 = Sat
    const dateStr = cur.toISOString().split("T")[0];

    // Exclude Saturday (6) and Sunday (0) and statutory public holidays
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateStr)) {
      workingDays++;
    }

    cur.setDate(cur.getDate() + 1);
  }

  return workingDays;
}

export const leavesRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook("preHandler", authenticate);

  // 1. Get user leave balances
  app.get("/balances", async (request, reply) => {
    const userId = request.user.userId;

    const balances = await db
      .select()
      .from(leaveBalances)
      .where(eq(leaveBalances.userId, userId));

    const mapped = balances.map((b) => {
      const allocated = parseFloat(b.allocatedDays);
      const used = parseFloat(b.usedDays);
      const pending = parseFloat(b.pendingDays);
      const available = Math.max(0, allocated - used - pending);
      return {
        leaveType: b.leaveType,
        allocatedDays: allocated,
        usedDays: used,
        pendingDays: pending,
        availableDays: available,
      };
    });

    return reply.send(mapped);
  });

  // 2. Get user own requests
  app.get("/my-requests", async (request, reply) => {
    const userId = request.user.userId;

    const requests = await db
      .select({
        req: leaveRequests,
        user: users,
      })
      .from(leaveRequests)
      .innerJoin(users, eq(leaveRequests.userId, users.id))
      .where(eq(leaveRequests.userId, userId))
      .orderBy(desc(leaveRequests.appliedOn));

    const mapped = requests.map(({ req, user }) => ({
      id: req.id,
      code: req.code,
      version: req.version,
      employeeId: user.id,
      employeeName: user.name,
      employeeCode: user.employeeCode,
      leaveType: req.leaveType,
      startDate: req.startDate,
      endDate: req.endDate,
      daysCount: parseFloat(req.daysCount),
      isHalfDay: req.isHalfDay,
      halfDayPeriod: req.halfDayPeriod || undefined,
      reason: req.reason,
      status:
        req.status === "pending_manager"
          ? "Pending"
          : req.status === "approved"
          ? "Approved"
          : "Rejected",
      appliedOn: req.appliedOn.toISOString().split("T")[0],
      managerComment: req.managerComment || undefined,
      attachmentUrl: req.attachmentUrl || undefined,
      hrOverrideReason: req.hrOverrideReason || undefined,
    }));

    return reply.send(mapped);
  });

  // 3. Get pending approvals (Waterfall: Line Manager views subordinates, HR/Admin views all for Option C override)
  app.get("/pending-approvals", async (request, reply) => {
    const { userId, orgId, role } = request.user;

    const isHrOrAdmin = role === "admin" || role === "hr";

    // Waterfall filter:
    // 1. Never show own requests in pending approval queue (cannot self-approve)
    // 2. If HR/Admin, see all pending within organization
    // 3. If Line Manager, see only direct subordinates where approverId == userId
    const conditions = [
      eq(leaveRequests.status, "pending_manager"),
      ne(leaveRequests.userId, userId),
    ];
    if (orgId) {
      conditions.push(eq(leaveRequests.orgId, orgId));
    }
    if (!isHrOrAdmin) {
      conditions.push(eq(leaveRequests.approverId, userId));
    }

    const requests = await db
      .select({
        req: leaveRequests,
        user: users,
      })
      .from(leaveRequests)
      .innerJoin(users, eq(leaveRequests.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(leaveRequests.appliedOn));

    const mapped = requests.map(({ req, user }) => ({
      id: req.id,
      code: req.code,
      version: req.version,
      employeeId: user.id,
      employeeName: user.name,
      employeeCode: user.employeeCode,
      department: user.departmentName || "General",
      leaveType: req.leaveType,
      startDate: req.startDate,
      endDate: req.endDate,
      daysCount: parseFloat(req.daysCount),
      isHalfDay: req.isHalfDay,
      halfDayPeriod: req.halfDayPeriod || undefined,
      reason: req.reason,
      status: "Pending",
      appliedOn: req.appliedOn.toISOString().split("T")[0],
      approverId: req.approverId,
      canDirectApprove: req.approverId === userId,
      isEmergencyOverride: isHrOrAdmin && req.approverId !== userId,
    }));

    return reply.send(mapped);
  });

  // 4. Create Leave Request (Waterfall N+1 Auto-Routing + Holiday Exclusion)
  app.post<{
    Body: {
      leaveType: string;
      startDate: string;
      endDate: string;
      isHalfDay: boolean;
      halfDayPeriod?: string;
      reason: string;
      attachmentUrl?: string;
    };
  }>("/", async (request, reply) => {
    const { userId, orgId } = request.user;
    const body = request.body;

    if (!body.leaveType || !body.startDate || !body.endDate || !body.reason) {
      return reply.status(400).send({ message: "leaveType, startDate, endDate, and reason are required" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }

    // Load statutory public holidays for organization
    const holidays = orgId
      ? await db
          .select({ date: publicHolidays.date })
          .from(publicHolidays)
          .where(eq(publicHolidays.orgId, orgId))
      : [];
    const holidaySet = new Set(holidays.map((h) => h.date));

    // Calculate actual deductible working days
    let daysCount = body.isHalfDay
      ? 0.5
      : calculateWorkingDays(body.startDate, body.endDate, holidaySet);

    if (daysCount <= 0) {
      daysCount = body.isHalfDay ? 0.5 : 1.0; // minimum 1 day or half day
    }

    const code = `LR-${Date.now().toString().slice(-6)}`;

    // Atomic leave submission, balance deduction, and audit log via Drizzle Transaction
    const created = await db.transaction(async (tx) => {
      // 1. Insert leave request with N+1 line manager auto-assigned as approver
      const [newRequest] = await tx
        .insert(leaveRequests)
        .values({
          orgId: orgId || null,
          code,
          userId,
          leaveType: body.leaveType,
          startDate: body.startDate,
          endDate: body.endDate,
          isHalfDay: body.isHalfDay,
          halfDayPeriod: body.halfDayPeriod || null,
          daysCount: daysCount.toFixed(2),
          reason: body.reason,
          status: "pending_manager",
          approverId: user.managerId || null, // Waterfall N+1 Line Manager
          attachmentUrl: body.attachmentUrl || null,
        })
        .returning();

      // 2. Increment pendingDays in leaveBalances
      const [balance] = await tx
        .select()
        .from(leaveBalances)
        .where(
          and(
            eq(leaveBalances.userId, userId),
            eq(leaveBalances.leaveType, body.leaveType),
            eq(leaveBalances.year, new Date().getFullYear())
          )
        )
        .limit(1);

      if (balance) {
        const newPending = (parseFloat(balance.pendingDays) + daysCount).toFixed(2);
        await tx
          .update(leaveBalances)
          .set({ pendingDays: newPending, updatedAt: new Date() })
          .where(eq(leaveBalances.id, balance.id));
      }

      // 3. Log to audit trail
      await tx.insert(leaveAuditLogs).values({
        orgId: orgId || null,
        requestId: newRequest.id,
        actorId: userId,
        action: "SUBMIT",
        fromStatus: null,
        toStatus: "pending_manager",
        comment: body.reason,
      });

      return newRequest;
    });

    return reply.status(201).send({
      id: created.id,
      code: created.code,
      version: created.version,
      employeeId: user.id,
      employeeName: user.name,
      employeeCode: user.employeeCode,
      leaveType: created.leaveType,
      startDate: created.startDate,
      endDate: created.endDate,
      daysCount: parseFloat(created.daysCount),
      isHalfDay: created.isHalfDay,
      halfDayPeriod: created.halfDayPeriod || undefined,
      reason: created.reason,
      status: "Pending",
      approverId: created.approverId,
      appliedOn: created.appliedOn.toISOString().split("T")[0],
    });
  });

  // 5. Review Leave Request (Line Manager OR Option C HR Emergency Override)
  app.put<{
    Params: { id: string };
    Body: {
      action: "Approve" | "Reject";
      comment?: string;
      version?: number;
    };
  }>("/:id/review", async (request, reply) => {
    const { id } = request.params;
    const { action, comment, version } = request.body || {};
    const { userId, role, orgId, name: actorName } = request.user;

    const [req] = await db
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.id, id))
      .limit(1);

    if (!req) {
      return reply.status(404).send({ message: "Leave request not found" });
    }

    // Already processed check (Conflict)
    if (req.status !== "pending_manager") {
      return reply.status(409).send({
        statusCode: 409,
        error: "Conflict",
        message: "Leave request has already been processed and cannot be reviewed again.",
      });
    }

    // Strict Anti-Self-Approval Enforcement (403 Forbidden)
    if (req.userId === userId) {
      return reply.status(403).send({
        statusCode: 403,
        error: "Forbidden",
        message: "Self-approval is strictly prohibited: you cannot review or approve your own leave request.",
      });
    }

    const isDirectManager = req.approverId === userId;
    const isHrOrAdmin = role === "admin" || role === "hr";

    // Permission Enforcement: Must be either direct line manager or HR Admin (Option C)
    if (!isDirectManager && !isHrOrAdmin) {
      return reply.status(403).send({
        statusCode: 403,
        error: "Forbidden",
        message: "You are not authorized to approve this leave request. Only the assigned line manager or HR Admin can review.",
      });
    }

    // Optimistic Concurrency Control (OCC) Check
    if (typeof version === "number" && req.version !== version) {
      return reply.status(409).send({
        statusCode: 409,
        error: "Conflict",
        message: "Data has been modified by another user. Please refresh the page to load the latest changes.",
        currentVersion: req.version,
      });
    }

    const isOverride = !isDirectManager && isHrOrAdmin;
    const nextStatus = action === "Approve" ? "approved" : "rejected";
    const auditAction = isOverride
      ? action === "Approve"
        ? "HR_OVERRIDE_APPROVE"
        : "HR_OVERRIDE_REJECT"
      : action === "Approve"
      ? "APPROVE"
      : "REJECT";

    const updateCondition =
      typeof version === "number"
        ? and(eq(leaveRequests.id, id), eq(leaveRequests.version, version))
        : eq(leaveRequests.id, id);

    const [updated] = await db
      .update(leaveRequests)
      .set({
        status: nextStatus,
        version: sql`${leaveRequests.version} + 1`,
        managerComment: comment || (action === "Approve" ? "Approved" : "Rejected"),
        hrOverrideById: isOverride ? userId : null,
        hrOverrideReason: isOverride
          ? comment || `Emergency override approval by HR Admin (${actorName})`
          : null,
        updatedAt: new Date(),
      })
      .where(updateCondition)
      .returning();

    if (!updated) {
      const [currentReq] = await db
        .select()
        .from(leaveRequests)
        .where(eq(leaveRequests.id, id))
        .limit(1);

      if (currentReq) {
        return reply.status(409).send({
          statusCode: 409,
          error: "Conflict",
          message: "Data has been modified by another user. Please refresh the page to load the latest changes.",
          currentVersion: currentReq.version,
        });
      }
      return reply.status(404).send({ message: "Leave request not found" });
    }

    // Update leave balances: deduct pendingDays; increment usedDays if approved
    const days = parseFloat(req.daysCount);
    const [balance] = await db
      .select()
      .from(leaveBalances)
      .where(
        and(
          eq(leaveBalances.userId, req.userId),
          eq(leaveBalances.leaveType, req.leaveType),
          eq(leaveBalances.year, new Date().getFullYear())
        )
      )
      .limit(1);

    if (balance) {
      const curPending = parseFloat(balance.pendingDays);
      const curUsed = parseFloat(balance.usedDays);
      const newPending = Math.max(0, curPending - days).toFixed(2);
      const newUsed = (action === "Approve" ? curUsed + days : curUsed).toFixed(2);

      await db
        .update(leaveBalances)
        .set({
          pendingDays: newPending,
          usedDays: newUsed,
          updatedAt: new Date(),
        })
        .where(eq(leaveBalances.id, balance.id));
    }

    // Log to immutable leave audit trail
    await db.insert(leaveAuditLogs).values({
      orgId: orgId || null,
      requestId: updated.id,
      actorId: userId,
      action: auditAction,
      fromStatus: req.status,
      toStatus: nextStatus,
      comment:
        comment ||
        (isOverride
          ? `Emergency HR override by ${actorName}`
          : `${action} by line manager ${actorName}`),
    });

    const [user] = await db.select().from(users).where(eq(users.id, updated.userId)).limit(1);

    return reply.send({
      id: updated.id,
      code: updated.code,
      version: updated.version,
      employeeId: user?.id,
      employeeName: user?.name,
      leaveType: updated.leaveType,
      daysCount: parseFloat(updated.daysCount),
      status: action === "Approve" ? "Approved" : "Rejected",
      managerComment: updated.managerComment,
      isEmergencyOverride: isOverride,
      hrOverrideReason: updated.hrOverrideReason,
      reviewedBy: actorName,
    });
  });

  // 6. GET /api/audit-logs (tenant immutable audit logs for Admin and Line Managers)
  app.get(
    "/audit-logs",
    { preHandler: [authenticate, authorize(["admin", "manager", "hr"])] },
    async (request, reply) => {
      const orgId = request.user.orgId;
      if (!orgId) {
        return reply.status(400).send({ message: "Organization ID is required" });
      }

      const logs = await db
        .select({
          id: leaveAuditLogs.id,
          requestId: leaveAuditLogs.requestId,
          requestCode: leaveRequests.code,
          actorId: leaveAuditLogs.actorId,
          actorName: users.name,
          actorRole: users.role,
          action: leaveAuditLogs.action,
          fromStatus: leaveAuditLogs.fromStatus,
          toStatus: leaveAuditLogs.toStatus,
          comment: leaveAuditLogs.comment,
          createdAt: leaveAuditLogs.createdAt,
        })
        .from(leaveAuditLogs)
        .leftJoin(users, eq(leaveAuditLogs.actorId, users.id))
        .leftJoin(leaveRequests, eq(leaveAuditLogs.requestId, leaveRequests.id))
        .where(eq(leaveAuditLogs.orgId, orgId))
        .orderBy(desc(leaveAuditLogs.createdAt))
        .limit(100);

      return reply.send({
        count: logs.length,
        auditLogs: logs.map((l) => ({
          id: l.id,
          requestId: l.requestId,
          requestCode: l.requestCode,
          actorId: l.actorId,
          actorName: l.actorName || "System Actor",
          actorRole: l.actorRole || "Admin",
          action: l.action,
          fromStatus: l.fromStatus,
          toStatus: l.toStatus,
          comment: l.comment,
          timestamp: l.createdAt.toISOString(),
        })),
      });
    }
  );
};
