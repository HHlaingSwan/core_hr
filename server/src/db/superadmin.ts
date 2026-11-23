import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { config } from "../config/index";
import * as schema from "./schema/index";

/**
 * Dedicated, standalone CLI provisioning script for Platform SuperAdmin.
 * Runs independently of demo seed data. Safe to execute multiple times in staging & production.
 */
async function provisionSuperAdmin() {
  const client = postgres(config.databaseUrl, { max: 1 });
  const db = drizzle(client, { schema });

  console.log("Checking Platform SuperAdmin account status...");

  const targetEmail = process.env.SUPERADMIN_EMAIL || "superadmin@omnihr.com";
  const targetPassword = process.env.SUPERADMIN_PASSWORD || "Password123!";
  const passwordHash = await bcrypt.hash(targetPassword, 10);

  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, targetEmail))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(schema.users)
      .set({
        role: "superadmin",
        orgId: null,
        isOrgAdmin: false,
        passwordHash,
        active: true,
        mustChangePassword: false,
        designation: "SaaS Platform SuperAdmin",
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, existing.id))
      .returning();

    console.log(`✓ SuperAdmin updated successfully: ${updated.email} (Role: ${updated.role}, OrgID: ${updated.orgId ?? "Global Platform / NULL"})`);
  } else {
    const [created] = await db
      .insert(schema.users)
      .values({
        orgId: null,
        isOrgAdmin: false,
        employeeCode: "PLATFORM-SA-0001",
        name: "Global Platform SuperAdmin",
        email: targetEmail,
        passwordHash,
        phone: "+95 9 000 000 000",
        role: "superadmin",
        designation: "SaaS Platform SuperAdmin",
        employmentType: "Platform",
        active: true,
        mustChangePassword: false,
      })
      .returning();

    console.log(`✓ SuperAdmin created successfully: ${created.email} (Role: ${created.role}, OrgID: ${created.orgId ?? "Global Platform / NULL"})`);
  }

  console.log(`\nDefault SuperAdmin Credentials:`);
  console.log(`Email   : ${targetEmail}`);
  console.log(`Password: ${targetPassword}`);
  console.log(`Scope   : Multi-Tenant Organization Creation & Tenant Lifecycle Only\n`);

  await client.end();
  process.exit(0);
}

provisionSuperAdmin().catch((err) => {
  console.error("SuperAdmin provisioning error:", err);
  process.exit(1);
});
