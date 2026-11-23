import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../db/index";
import { expenseClaims } from "../../db/schema/claims";
import { users } from "../../db/schema/users";
import { authenticate, authorize } from "../../middleware/auth";

export const claimsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook("preHandler", authenticate);

  // 1. Get Expense Claims (Scoped to Organization, Role & IDOR protected)
  app.get<{
    Querystring: { status?: string };
  }>("/", async (request, reply) => {
    const { userId, orgId, role } = request.user;
    const { status } = request.query;

    if (!orgId) {
      return reply.status(400).send({ message: "User is not associated with an organization" });
    }

    const conditions = [eq(expenseClaims.orgId, orgId)];

    // IDOR protection: Standard staff see only their own claims
    const isApprover = ["admin", "hr", "manager", "payroll"].includes(role);
    if (!isApprover) {
      conditions.push(eq(expenseClaims.userId, userId));
    }

    if (status) {
      conditions.push(eq(expenseClaims.status, status));
    }

    const list = await db
      .select({
        id: expenseClaims.id,
        title: expenseClaims.title,
        category: expenseClaims.category,
        amount: expenseClaims.amount,
        currency: expenseClaims.currency,
        expenseDate: expenseClaims.expenseDate,
        receiptUrl: expenseClaims.receiptUrl,
        status: expenseClaims.status,
        notes: expenseClaims.notes,
        createdAt: expenseClaims.createdAt,
        userId: expenseClaims.userId,
        employeeName: users.name,
        employeeCode: users.employeeCode,
        department: users.departmentName,
      })
      .from(expenseClaims)
      .innerJoin(users, eq(expenseClaims.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(expenseClaims.createdAt));

    const mapped = list.map((c) => ({
      ...c,
      amount: parseFloat(c.amount),
    }));

    return reply.send(mapped);
  });

  // 2. Submit New Expense Claim (Always in MMK currency)
  app.post<{
    Body: {
      title: string;
      category: string;
      amount: number | string;
      expenseDate: string;
      receiptUrl?: string;
      notes?: string;
    };
  }>("/", async (request, reply) => {
    const { userId, orgId } = request.user;
    const { title, category, amount, expenseDate, receiptUrl, notes } = request.body || {};

    if (!orgId) {
      return reply.status(400).send({ message: "Organization ID is required" });
    }

    if (!title || !category || amount === undefined || !expenseDate) {
      return reply.status(400).send({
        message: "title, category, amount, and expenseDate are required",
      });
    }

    const numericAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return reply.status(400).send({ message: "Amount must be a positive number in MMK" });
    }

    const [created] = await db.transaction(async (tx) => {
      return tx
        .insert(expenseClaims)
        .values({
          orgId,
          userId,
          title: title.trim(),
          category: category.trim(),
          amount: numericAmount.toFixed(2),
          currency: "MMK",
          expenseDate,
          receiptUrl: receiptUrl || null,
          status: "Submitted",
          notes: notes || null,
        })
        .returning();
    });

    return reply.status(201).send({
      message: "Expense claim submitted successfully",
      claim: {
        ...created,
        amount: parseFloat(created.amount),
      },
    });
  });

  // 3. Review Expense Claim (Approve, Reject, or Reimburse)
  app.put<{
    Params: { id: string };
    Body: {
      status: "Approved" | "Rejected" | "Reimbursed";
      notes?: string;
    };
  }>("/:id/review", { preHandler: [authorize(["admin", "hr", "manager", "payroll"])] }, async (request, reply) => {
    const { id } = request.params;
    const { orgId } = request.user;
    const { status, notes } = request.body || {};

    if (!["Approved", "Rejected", "Reimbursed"].includes(status)) {
      return reply.status(400).send({
        message: "Status must be either 'Approved', 'Rejected', or 'Reimbursed'",
      });
    }

    const [existing] = await db
      .select()
      .from(expenseClaims)
      .where(and(eq(expenseClaims.id, id), eq(expenseClaims.orgId, orgId!)))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ message: "Expense claim not found or access denied" });
    }

    const [updated] = await db
      .update(expenseClaims)
      .set({
        status,
        notes: notes !== undefined ? notes : existing.notes,
      })
      .where(eq(expenseClaims.id, id))
      .returning();

    return reply.send({
      message: `Expense claim marked as ${status}`,
      claim: {
        ...updated,
        amount: parseFloat(updated.amount),
      },
    });
  });
};
