import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { config } from "../config/index";

async function runMigration() {
  const migrationClient = postgres(config.databaseUrl, {
    max: 1,
  });
  const db = drizzle(migrationClient);

  console.log("Running migrations on local PostgreSQL database...");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("Migrations applied successfully to local PostgreSQL database!");

  await migrationClient.end();
  process.exit(0);
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
