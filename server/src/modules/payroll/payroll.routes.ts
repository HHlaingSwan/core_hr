import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../db/index";
import { payslips, payslipItems } from "../../db/schema/payroll";
import { authenticate } from "../../middleware/auth";

export const payrollRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook("preHandler", authenticate);

  // Get user payslips summary
  app.get("/payslips", async (request, reply) => {
    const userId = request.user.userId;

    const list = await db
      .select()
      .from(payslips)
      .where(eq(payslips.userId, userId))
      .orderBy(desc(payslips.payDate));

    const mapped = list.map((p) => ({
      id: p.id,
      month: p.month,
      year: p.year,
      monthName: p.monthName,
      payDate: p.payDate,
      grossEarnings: parseFloat(p.grossEarnings),
      totalDeductions: parseFloat(p.totalDeductions),
      netPay: parseFloat(p.netPay),
      currency: p.currency,
      status: p.status as "Paid" | "Processing" | "Held",
    }));

    return reply.send(mapped);
  });

  // Get payslip detail (Protected with BOLA / IDOR ownership validation)
  app.get<{
    Params: { id: string };
  }>("/payslips/:id", async (request, reply) => {
    const { id } = request.params;
    const { userId, role } = request.user;
    const isStaffOrAdmin = ["admin", "payroll", "hr"].includes(role);

    const conditions = [eq(payslips.id, id)];
    // Enforce ownership: Non-admins can strictly only fetch their own payslips
    if (!isStaffOrAdmin) {
      conditions.push(eq(payslips.userId, userId));
    }

    const [payslip] = await db
      .select()
      .from(payslips)
      .where(and(...conditions))
      .limit(1);

    if (!payslip) {
      return reply.status(404).send({ message: "Payslip not found or access denied" });
    }

    const items = await db
      .select()
      .from(payslipItems)
      .where(eq(payslipItems.payslipId, payslip.id));

    const earnings = items
      .filter((i) => i.category === "Earning")
      .map((i) => ({ name: i.name, amount: parseFloat(i.amount), category: "Earning" as const }));

    const deductions = items
      .filter((i) => i.category === "Deduction")
      .map((i) => ({ name: i.name, amount: parseFloat(i.amount), category: "Deduction" as const }));

    return reply.send({
      id: payslip.id,
      month: payslip.month,
      year: payslip.year,
      monthName: payslip.monthName,
      payDate: payslip.payDate,
      grossEarnings: parseFloat(payslip.grossEarnings),
      totalDeductions: parseFloat(payslip.totalDeductions),
      netPay: parseFloat(payslip.netPay),
      currency: payslip.currency,
      status: payslip.status as "Paid" | "Processing" | "Held",
      earnings,
      deductions,
      bankName: payslip.bankName || "KBZ Bank",
      bankAccountMasked: payslip.bankAccountMasked || "•••• •••• •••• 6789",
      taxNumberMasked: payslip.taxNumberMasked || "T-9876-MM",
      downloadUrl: payslip.downloadUrl || undefined,
    });
  });
};
