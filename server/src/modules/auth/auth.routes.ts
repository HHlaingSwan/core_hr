import { FastifyInstance, FastifyPluginAsync } from "fastify";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { users, refreshTokens, departments } from "../../db/schema/users";
import { organizations } from "../../db/schema/organizations";
import { officeLocations } from "../../db/schema/attendance";
import { authenticate } from "../../middleware/auth";

// SHA-256 token hashing helper to protect refresh tokens at rest
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export const authRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // 1. Organization Registration (Web Portal Only)
  app.post<{
    Body: {
      orgName: string;
      orgCode: string;
      adminName: string;
      adminEmail: string;
      adminPassword: string;
      taxId?: string;
      phone?: string;
      address?: string;
      officeName?: string;
      officeLat?: string;
      officeLng?: string;
      officeRadius?: number;
    };
  }>("/register-org", async (request, reply) => {
    const {
      orgName,
      orgCode,
      adminName,
      adminEmail,
      adminPassword,
      taxId,
      phone,
      address,
      officeName,
      officeLat,
      officeLng,
      officeRadius,
    } = request.body || {};

    if (!orgName || !orgCode || !adminName || !adminEmail || !adminPassword) {
      return reply.status(400).send({
        message: "orgName, orgCode, adminName, adminEmail, and adminPassword are required",
      });
    }

    // Check unique email and org code
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1);

    if (existingUser) {
      return reply.status(409).send({ message: "An account with this email already exists" });
    }

    const [existingOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.code, orgCode.toUpperCase()))
      .limit(1);

    if (existingOrg) {
      return reply.status(409).send({ message: "An organization with this code already exists" });
    }

    // Atomic organization onboarding via Drizzle Transaction
    const { org, execDept, adminUser, accessToken, refreshToken } = await db.transaction(async (tx) => {
      // 1. Create organization
      const [newOrg] = await tx
        .insert(organizations)
        .values({
          name: orgName,
          code: orgCode.toUpperCase(),
          currency: "MMK",
          taxId: taxId || null,
          phone: phone || null,
          address: address || null,
        })
        .returning();

      // 2. Create initial default departments
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
        { orgId: newOrg.id, name: "Product Engineering", code: "ENG" },
        { orgId: newOrg.id, name: "Finance & Payroll", code: "FIN" },
      ]);

      // 3. Create primary office location (Default: Yangon HQ or passed coords)
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

      // 4. Create SuperAdmin User
      const passwordHash = await bcrypt.hash(adminPassword, 10);
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
          role: "admin",
          departmentId: newExecDept.id,
          departmentName: newExecDept.name,
          designation: "Founder / Managing Director",
          employmentType: "Permanent",
          startDate: new Date().toISOString().split("T")[0],
        })
        .returning();

      const payload = {
        userId: newAdminUser.id,
        email: newAdminUser.email,
        role: newAdminUser.role,
        name: newAdminUser.name,
        orgId: newOrg.id,
        branchId: newHqOffice.id,
        isOrgAdmin: true,
      };

      const newAccessToken = app.jwt.sign(payload, { expiresIn: "1h" });
      const newRefreshToken = app.jwt.sign(
        { ...payload, jti: crypto.randomUUID() },
        { expiresIn: "7d" }
      );

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Store hashed refresh token
      await tx.insert(refreshTokens).values({
        userId: newAdminUser.id,
        tokenHash: hashToken(newRefreshToken),
        expiresAt,
      });

      return {
        org: newOrg,
        execDept: newExecDept,
        adminUser: newAdminUser,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    });

    return reply.status(201).send({
      message: "Organization registered successfully",
      organization: {
        id: org.id,
        name: org.name,
        code: org.code,
        currency: org.currency,
      },
      accessToken,
      refreshToken,
      expiresIn: 3600,
      user: {
        id: adminUser.id,
        employeeCode: adminUser.employeeCode,
        fullName: adminUser.name,
        email: adminUser.email,
        role: "Admin",
        isOrgAdmin: true,
        department: execDept.name,
        designation: adminUser.designation,
      },
    });
  });

  // 2. Login (Mobile ESS & Web Dashboard)
  app.post<{
    Body: { email: string; password?: string; client?: "web" | "mobile" };
  }>("/login", async (request, reply) => {
    const { email, password, client } = request.body || {};

    if (!email) {
      return reply.status(400).send({ message: "Email is required" });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      return reply.status(401).send({ message: "Invalid email or password" });
    }

    if (!user.active) {
      return reply.status(403).send({ message: "Account is deactivated. Please contact your HR administrator." });
    }

    if (password) {
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return reply.status(401).send({ message: "Invalid email or password" });
      }
    }

    // Role-based platform restriction: Standard employees are mobile ESS only
    const clientHeader = request.headers["x-client-platform"];
    const isWebClient = client === "web" || clientHeader === "web";
    if (isWebClient && user.role === "employee") {
      return reply.status(403).send({
        statusCode: 403,
        error: "Forbidden",
        message: "Web dashboard access is restricted to Managers, HR Specialists, and Administrators. Standard staff must use the Omni HR Mobile App.",
      });
    }

    const roleCapitalized =
      user.role === "superadmin"
        ? "SuperAdmin"
        : user.role === "manager"
        ? "Manager"
        : user.role === "admin"
        ? "Admin"
        : user.role === "hr"
        ? "HR"
        : user.role === "payroll"
        ? "Payroll"
        : "Employee";

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      orgId: user.orgId || undefined,
      branchId: user.branchId || undefined,
      isOrgAdmin: user.isOrgAdmin,
    };

    const accessToken = app.jwt.sign(payload, { expiresIn: "1h" });
    const refreshToken = app.jwt.sign(
      { ...payload, jti: crypto.randomUUID() },
      { expiresIn: "7d" }
    );

    // Store hashed refresh token in DB
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt,
    });

    return reply.send({
      accessToken,
      refreshToken,
      expiresIn: 3600,
      user: {
        id: user.id,
        orgId: user.orgId,
        isOrgAdmin: user.isOrgAdmin,
        branchId: user.branchId,
        employeeCode: user.employeeCode,
        fullName: user.name,
        email: user.email,
        phone: user.phone || "",
        avatarUrl: user.avatarUrl || undefined,
        role: roleCapitalized,
        department: user.departmentName || "General",
        designation: user.designation || "Staff",
        permissions: user.permissions || undefined,
        mustChangePassword: user.mustChangePassword,
        tempPassword: user.tempPassword || undefined,
        joinDate: user.startDate || new Date().toISOString().split("T")[0],
        reportingManagerName: user.managerName || undefined,
        nrcNumber: user.nrcNumber || undefined,
        ssbNumber: user.ssbNumber || undefined,
      },
    });
  });

  // 3. Get current user profile
  app.get("/me", { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }

    const roleCapitalized =
      user.role === "superadmin"
        ? "SuperAdmin"
        : user.role === "manager"
        ? "Manager"
        : user.role === "admin"
        ? "Admin"
        : user.role === "hr"
        ? "HR"
        : user.role === "payroll"
        ? "Payroll"
        : "Employee";

    return reply.send({
      id: user.id,
      orgId: user.orgId,
      isOrgAdmin: user.isOrgAdmin,
      branchId: user.branchId,
      employeeCode: user.employeeCode,
      fullName: user.name,
      email: user.email,
      phone: user.phone || "",
      avatarUrl: user.avatarUrl || undefined,
      role: roleCapitalized,
      department: user.departmentName || "General",
      designation: user.designation || "Staff",
      permissions: user.permissions || undefined,
      mustChangePassword: user.mustChangePassword,
      joinDate: user.startDate || new Date().toISOString().split("T")[0],
      reportingManagerName: user.managerName || undefined,
      nrcNumber: user.nrcNumber || undefined,
      ssbNumber: user.ssbNumber || undefined,
    });
  });

  // 4. Change password
  app.post<{
    Body: { newPassword: string };
  }>("/change-password", { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const { newPassword } = request.body || {};

    if (!newPassword || newPassword.length < 8) {
      return reply.status(400).send({ message: "Password must be at least 8 characters" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const [updated] = await db
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: false,
        tempPassword: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) {
      return reply.status(404).send({ message: "User not found" });
    }

    return reply.send({ message: "Password updated successfully" });
  });

  // 5. Refresh token (supports both /refresh-token and /refresh)
  const handleRefreshToken = async (request: any, reply: any) => {
    const { refreshToken } = request.body || {};

    if (!refreshToken) {
      return reply.status(400).send({ message: "Refresh token is required" });
    }

    try {
      const decoded = app.jwt.verify<{
        userId: string;
        email: string;
        role: string;
        name: string;
        orgId?: string;
        branchId?: string;
        isOrgAdmin?: boolean;
      }>(refreshToken);

      const [storedToken] = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, hashToken(refreshToken)))
        .limit(1);

      if (!storedToken || storedToken.isRevoked) {
        return reply.status(401).send({ message: "Invalid or revoked refresh token" });
      }

      const payload = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name,
        orgId: decoded.orgId,
        branchId: decoded.branchId,
        isOrgAdmin: decoded.isOrgAdmin,
      };

      const newAccessToken = app.jwt.sign(payload, { expiresIn: "1h" });
      const newRefreshToken = app.jwt.sign(
        { ...payload, jti: crypto.randomUUID() },
        { expiresIn: "7d" }
      );

      // Rotate hashed token in DB
      await db
        .update(refreshTokens)
        .set({ tokenHash: hashToken(newRefreshToken) })
        .where(eq(refreshTokens.id, storedToken.id));

      return reply.send({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 3600,
      });
    } catch {
      return reply.status(401).send({ message: "Invalid refresh token" });
    }
  };

  app.post("/refresh-token", handleRefreshToken);
  app.post("/refresh", handleRefreshToken);

  // 5. Logout
  app.post("/logout", async (_request, reply) => {
    return reply.send({ message: "Logged out successfully" });
  });
};
