import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import { config } from "./config/index";

import { authRoutes } from "./modules/auth/auth.routes";
import { employeesRoutes } from "./modules/employees/employees.routes";
import { attendanceRoutes } from "./modules/attendance/attendance.routes";
import { leavesRoutes } from "./modules/leaves/leaves.routes";
import { payrollRoutes } from "./modules/payroll/payroll.routes";
import { announcementsRoutes } from "./modules/announcements/announcements.routes";
import { platformRoutes } from "./modules/platform/platform.routes";
import { claimsRoutes } from "./modules/claims/claims.routes";
import { rolesRoutes } from "./modules/roles/roles.routes";
import { idempotencyPreHandler, saveIdempotencyRecord } from "./middleware/idempotency";


export function buildApp() {
  const app = Fastify({
    logger: {
      level: config.nodeEnv === "development" ? "info" : "warn",
    },
  });

  // CORS - allow all for development (Expo Go, mobile emulator, web dashboard)
  app.register(cors, {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  // Security Headers
  app.register(helmet, {
    contentSecurityPolicy: false,
  });

  // JWT Plugin
  app.register(jwt, {
    secret: config.jwtSecret,
  });

  // Enterprise Idempotency Hooks
  app.addHook("preHandler", idempotencyPreHandler);
  app.addHook("onSend", saveIdempotencyRecord);

  // Healthcheck endpoint
  app.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  // Register Feature Route Modules under /api
  app.register(authRoutes, { prefix: "/api/auth" });
  app.register(employeesRoutes, { prefix: "/api/employees" });
  app.register(attendanceRoutes, { prefix: "/api/attendance" });
  app.register(leavesRoutes, { prefix: "/api/leaves" });
  app.register(payrollRoutes, { prefix: "/api/payroll" });
  app.register(announcementsRoutes, { prefix: "/api/announcements" });
  app.register(platformRoutes, { prefix: "/api/platform" });
  app.register(claimsRoutes, { prefix: "/api/claims" });
  app.register(rolesRoutes, { prefix: "/api" });


  // Centralized Error Handler: Unmask real PostgreSQL & validation errors
  app.setErrorHandler((error: any, request, reply) => {
    request.log.error(error);

    const anyErr = error || {};
    const dbErr = anyErr.cause || anyErr;
    const pgCode = dbErr.code || anyErr.code;
    let statusCode = anyErr.statusCode || 500;
    let message = anyErr.message || "An unexpected error occurred.";
    let details: string | undefined = dbErr.detail || anyErr.detail;

    // PostgreSQL & Drizzle specific error extraction
    if (pgCode === "23505") {
      statusCode = 409;
      message = details
        ? `Database Unique Constraint Violation: ${details}`
        : "A record with this unique identifier or email already exists in the database.";
    } else if (pgCode === "23503") {
      statusCode = 400;
      message = details
        ? `Database Foreign Key Violation: ${details}`
        : "Referenced relationship or parent record does not exist.";
    } else if (pgCode === "23502") {
      statusCode = 400;
      const col = dbErr.column || anyErr.column || "required column";
      message = `Database Required Field Missing: '${col}' cannot be null.`;
    } else if (pgCode === "ECONNREFUSED" || anyErr.message?.includes("connect ECONNREFUSED")) {
      statusCode = 503;
      message = "Database connection error: Unable to reach PostgreSQL server.";
    } else if (anyErr.validation) {
      statusCode = 400;
      message = anyErr.message || "Invalid request payload format.";
    } else if (statusCode === 500) {
      // Ensure real error message is surfaced instead of Fastify's generic "Internal Server Error"
      if (details) {
        message = `${message} (${details})`;
      }
    }

    return reply.status(statusCode).send({
      statusCode,
      error: anyErr.name || (statusCode >= 500 ? "Internal Server Error" : "Bad Request"),
      message,
      details,
    });
  });

  return app;
}
