import { FastifyRequest, FastifyReply } from "fastify";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index";
import { idempotencyRecords } from "../db/schema/idempotency";

/**
 * Enterprise Idempotency Middleware
 * Ensures mutating HTTP calls (POST, PUT, PATCH, DELETE) with an Idempotency-Key
 * are executed at-most-once. Repeated calls return the exact cached response.
 */
export async function idempotencyPreHandler(request: FastifyRequest, reply: FastifyReply) {
  const method = request.method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return;
  }

  const rawKey =
    request.headers["idempotency-key"] ||
    request.headers["x-idempotency-key"];

  if (!rawKey) {
    return;
  }

  const key = Array.isArray(rawKey) ? rawKey[0].trim() : String(rawKey).trim();
  if (!key) return;

  const userId = request.user?.userId || null;

  try {
    const conditions = [eq(idempotencyRecords.key, key)];
    if (userId) {
      conditions.push(eq(idempotencyRecords.userId, userId));
    }

    const [existing] = await db
      .select()
      .from(idempotencyRecords)
      .where(and(...conditions))
      .limit(1);

    if (existing && new Date(existing.expiresAt) > new Date()) {
      reply.header("x-idempotency-hit", "true");
      reply.header("content-type", "application/json");
      return reply.status(existing.statusCode).send(existing.responseBody);
    }
  } catch (err) {
    request.log.error(err, "Error checking idempotency record");
  }
}

/**
 * Captures outgoing response payload and records it for the given Idempotency-Key
 */
export async function saveIdempotencyRecord(
  request: FastifyRequest,
  reply: FastifyReply,
  payload: any
) {
  const method = request.method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return payload;
  }

  const rawKey =
    request.headers["idempotency-key"] ||
    request.headers["x-idempotency-key"];

  if (!rawKey) {
    return payload;
  }

  const key = Array.isArray(rawKey) ? rawKey[0].trim() : String(rawKey).trim();
  if (!key) return payload;

  // Don't save if it was a cache hit
  if (reply.getHeader("x-idempotency-hit")) {
    return payload;
  }

  const userId = request.user?.userId || null;
  const statusCode = reply.statusCode;

  // Only cache successful or intentional client rejection responses (not 500 crashes)
  if (statusCode >= 500) {
    return payload;
  }

  try {
    const bodyStr = typeof payload === "string" ? payload : JSON.stringify(payload);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24hr TTL

    await db
      .insert(idempotencyRecords)
      .values({
        key,
        userId,
        method,
        path: request.url,
        statusCode,
        responseBody: bodyStr,
        expiresAt,
      })
      .onConflictDoNothing();
  } catch (err) {
    request.log.error(err, "Error persisting idempotency record");
  }

  return payload;
}
