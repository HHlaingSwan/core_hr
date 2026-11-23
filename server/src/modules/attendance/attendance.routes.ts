import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { db } from "../../db/index";
import {
  attendanceRecords,
  attendancePunches,
  officeLocations,
  attendanceRegularizations,
} from "../../db/schema/attendance";
import { users } from "../../db/schema/users";
import { authenticate, authorize } from "../../middleware/auth";

// Haversine formula to compute exact distance in meters between two GPS coordinates
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function formatTimeString(time: string | null | undefined): string | undefined {
  if (!time) return undefined;
  const parts = time.split(":");
  if (parts.length < 2) return time;
  let hour = parseInt(parts[0], 10);
  const minute = parts[1];
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  hour = hour ? hour : 12;
  const hourStr = hour < 10 ? `0${hour}` : `${hour}`;
  return `${hourStr}:${minute} ${ampm}`;
}

export const attendanceRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook("preHandler", authenticate);

  // 1. Get Organization Branches / Offices for Map & Geofence
  app.get("/branches", async (request, reply) => {
    const orgId = request.user.orgId;
    if (!orgId) {
      return reply.status(400).send({ message: "No organization associated with user" });
    }

    const branches = await db
      .select()
      .from(officeLocations)
      .where(and(eq(officeLocations.orgId, orgId), eq(officeLocations.isActive, true)));

    return reply.send(branches);
  });

  // 2. Attendance Summary (Optimized with Database SQL Aggregations)
  app.get("/summary", async (request, reply) => {
    const userId = request.user.userId;
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed

    const startOfMonth = new Date(year, month, 1).toISOString().split("T")[0];
    const endOfMonth = new Date(year, month + 1, 0).toISOString().split("T")[0];

    // Single indexed query for today's punch record
    const [todayRecord] = await db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.userId, userId), eq(attendanceRecords.date, today)))
      .limit(1);

    let currentStatus: "NotCheckedIn" | "CheckedIn" | "CheckedOut" = "NotCheckedIn";
    if (todayRecord) {
      if (todayRecord.clockInTime && !todayRecord.clockOutTime) {
        currentStatus = "CheckedIn";
      } else if (todayRecord.clockInTime && todayRecord.clockOutTime) {
        currentStatus = "CheckedOut";
      }
    }

    // High-performance single PostgreSQL aggregation query for the current month
    const [stats] = await db
      .select({
        presentCount: sql<number>`count(case when ${attendanceRecords.status} in ('present', 'remote') then 1 end)::int`,
        remoteCount: sql<number>`count(case when ${attendanceRecords.status} = 'remote' then 1 end)::int`,
        lateCount: sql<number>`count(case when ${attendanceRecords.status} = 'late' then 1 end)::int`,
        onLeaveCount: sql<number>`count(case when ${attendanceRecords.status} = 'on_leave' then 1 end)::int`,
        absentCount: sql<number>`count(case when ${attendanceRecords.status} = 'absent' then 1 end)::int`,
        totalMinutes: sql<number>`coalesce(sum(${attendanceRecords.workMinutes}), 0)::int`,
      })
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.userId, userId),
          gte(attendanceRecords.date, startOfMonth),
          lte(attendanceRecords.date, endOfMonth)
        )
      );

    const totalWorkHours = Number(((stats?.totalMinutes || 0) / 60).toFixed(1));

    return reply.send({
      totalWorkingDays: 22,
      presentDays: stats?.presentCount || 0,
      remoteDays: stats?.remoteCount || 0,
      absentDays: stats?.absentCount || 0,
      lateDays: stats?.lateCount || 0,
      onLeaveDays: stats?.onLeaveCount || 0,
      totalWorkHours,
      currentStatus,
      todayRecord: todayRecord
        ? {
            id: todayRecord.id,
            date: todayRecord.date,
            checkInTime: formatTimeString(todayRecord.clockInTime),
            checkOutTime: formatTimeString(todayRecord.clockOutTime),
            status:
              todayRecord.status === "late"
                ? "Late"
                : todayRecord.status === "remote"
                ? "Remote"
                : "Present",
            workHours: Number(((todayRecord.workMinutes || 0) / 60).toFixed(1)),
            locationName: todayRecord.locationName || "Office Geofence Verified",
            note: todayRecord.note || undefined,
          }
        : undefined,
    });
  });

  // 3. Attendance History (Scoped by Month/Year with sensible limit)
  app.get<{
    Querystring: { month?: number; year?: number };
  }>("/history", async (request, reply) => {
    const userId = request.user.userId;
    const { month, year } = request.query || {};

    const conditions = [eq(attendanceRecords.userId, userId)];

    if (month && year) {
      const startOfMonth = new Date(year, month - 1, 1).toISOString().split("T")[0];
      const endOfMonth = new Date(year, month, 0).toISOString().split("T")[0];
      conditions.push(gte(attendanceRecords.date, startOfMonth));
      conditions.push(lte(attendanceRecords.date, endOfMonth));
    }

    const records = await db
      .select()
      .from(attendanceRecords)
      .where(and(...conditions))
      .orderBy(desc(attendanceRecords.date))
      .limit(60);

    const mapped = records.map((r) => ({
      id: r.id,
      date: r.date,
      checkInTime: formatTimeString(r.clockInTime),
      checkOutTime: formatTimeString(r.clockOutTime),
      status:
        r.status === "late"
          ? "Late"
          : r.status === "remote"
          ? "Remote"
          : r.status === "on_leave"
          ? "OnLeave"
          : "Present",
      workHours: Number(((r.workMinutes || 0) / 60).toFixed(1)),
      isLateCheckIn: (r.lateMinutes || 0) > 0,
      isEarlyCheckOut: (r.undertimeMinutes || 0) > 0,
      locationName: r.locationName || "Office Location",
      note: r.note || undefined,
    }));

    return reply.send(mapped);
  });

  // 4. Precision Check-In (Multi-Office Haversine Evaluation & Remote Prompt)
  app.post<{
    Body: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      deviceId?: string;
      isRemoteConfirmed?: boolean;
      remoteReason?: string;
      notes?: string;
    };
  }>("/check-in", async (request, reply) => {
    const { userId, orgId } = request.user;
    const body = request.body || {};
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

    // Load all active branches for this organization
    const branches = orgId
      ? await db
          .select()
          .from(officeLocations)
          .where(and(eq(officeLocations.orgId, orgId), eq(officeLocations.isActive, true)))
      : [];

    let matchedBranch = null;
    let nearestBranch = null;
    let nearestDistance = Infinity;

    if (branches.length > 0 && body.latitude && body.longitude) {
      for (const branch of branches) {
        const dist = getDistanceInMeters(
          body.latitude,
          body.longitude,
          parseFloat(branch.latitude),
          parseFloat(branch.longitude)
        );

        if (dist < nearestDistance) {
          nearestDistance = dist;
          nearestBranch = branch;
        }

        if (dist <= branch.radiusMeters) {
          matchedBranch = branch;
          nearestDistance = dist;
          break;
        }
      }
    }

    const isInGeofence = matchedBranch !== null;

    // Out-of-Range Prompt Flow
    if (!isInGeofence && branches.length > 0 && !body.isRemoteConfirmed) {
      const nearestName = nearestBranch?.name || "the office";
      const distanceDisplay =
        nearestDistance < 1000 ? `${nearestDistance}m` : `${(nearestDistance / 1000).toFixed(1)}km`;

      return reply.send({
        requiresRemoteConfirmation: true,
        nearestBranchName: nearestName,
        nearestBranchId: nearestBranch?.id,
        distanceMeters: nearestDistance,
        message: `You are not within range of any office (Nearest: ${nearestName}, ${distanceDisplay} away). Do you want to submit a Remote Check-In?`,
      });
    }

    // Determine status & location
    const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 15);
    const lateMinutes = isLate ? (now.getHours() - 9) * 60 + now.getMinutes() : 0;

    let punchStatus = "present";
    let locationName = matchedBranch?.name || "Office Geofence Verified";
    const isOutsideGeofence = !isInGeofence;

    if (!isInGeofence) {
      punchStatus = "remote";
      const distKm = (nearestDistance / 1000).toFixed(1);
      locationName = `Remote (${distKm}km from ${nearestBranch?.name || "Office"})`;
    } else if (isLate) {
      punchStatus = "late";
    }

    const note = body.remoteReason || body.notes || (isOutsideGeofence ? "Remote Check-In" : null);

    // 1. Immutable Raw Punch Audit Log
    await db.insert(attendancePunches).values({
      orgId: orgId || null,
      userId,
      punchType: "check_in",
      punchTime: now,
      latitude: body.latitude?.toString() || "0",
      longitude: body.longitude?.toString() || "0",
      accuracy: body.accuracy?.toString() || null,
      distanceMeters: nearestDistance === Infinity ? null : nearestDistance,
      branchId: matchedBranch?.id || nearestBranch?.id || null,
      isOutsideGeofence,
      isMockLocation: false,
      deviceId: body.deviceId || null,
      note,
    });

    // 2. Daily Summary Record
    const [existing] = await db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.userId, userId), eq(attendanceRecords.date, today)))
      .limit(1);

    let record;
    if (existing) {
      const [updated] = await db
        .update(attendanceRecords)
        .set({
          clockInTime: timeStr,
          status: punchStatus,
          lateMinutes,
          latitude: body.latitude?.toString(),
          longitude: body.longitude?.toString(),
          accuracy: body.accuracy?.toString(),
          deviceId: body.deviceId,
          locationName,
          branchId: matchedBranch?.id || nearestBranch?.id || null,
          note,
          updatedAt: new Date(),
        })
        .where(eq(attendanceRecords.id, existing.id))
        .returning();
      record = updated;
    } else {
      const [created] = await db
        .insert(attendanceRecords)
        .values({
          orgId: orgId || null,
          userId,
          branchId: matchedBranch?.id || nearestBranch?.id || null,
          date: today,
          clockInTime: timeStr,
          status: punchStatus,
          lateMinutes,
          workMinutes: 0,
          latitude: body.latitude?.toString(),
          longitude: body.longitude?.toString(),
          accuracy: body.accuracy?.toString(),
          deviceId: body.deviceId,
          locationName,
          source: "mobile_geo",
          note,
        })
        .returning();
      record = created;
    }

    return reply.send({
      id: record.id,
      date: record.date,
      checkInTime: formatTimeString(record.clockInTime),
      status: record.status === "late" ? "Late" : record.status === "remote" ? "Remote" : "Present",
      workHours: 0,
      locationName: record.locationName,
      isOutsideGeofence,
      note: record.note,
    });
  });

  // 5. Precision Check-Out
  app.post<{
    Body: {
      latitude: number;
      longitude: number;
      deviceId?: string;
      isRemoteConfirmed?: boolean;
      remoteReason?: string;
      notes?: string;
    };
  }>("/check-out", async (request, reply) => {
    const { userId, orgId } = request.user;
    const body = request.body || {};
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

    // Load active branches
    const branches = orgId
      ? await db
          .select()
          .from(officeLocations)
          .where(and(eq(officeLocations.orgId, orgId), eq(officeLocations.isActive, true)))
      : [];

    let matchedBranch = null;
    let nearestBranch = null;
    let nearestDistance = Infinity;

    if (branches.length > 0 && body.latitude && body.longitude) {
      for (const branch of branches) {
        const dist = getDistanceInMeters(
          body.latitude,
          body.longitude,
          parseFloat(branch.latitude),
          parseFloat(branch.longitude)
        );

        if (dist < nearestDistance) {
          nearestDistance = dist;
          nearestBranch = branch;
        }

        if (dist <= branch.radiusMeters) {
          matchedBranch = branch;
          nearestDistance = dist;
          break;
        }
      }
    }

    const isInGeofence = matchedBranch !== null;

    // Out-of-Range Prompt Flow
    if (!isInGeofence && branches.length > 0 && !body.isRemoteConfirmed) {
      const nearestName = nearestBranch?.name || "the office";
      const distanceDisplay =
        nearestDistance < 1000 ? `${nearestDistance}m` : `${(nearestDistance / 1000).toFixed(1)}km`;

      return reply.send({
        requiresRemoteConfirmation: true,
        nearestBranchName: nearestName,
        nearestBranchId: nearestBranch?.id,
        distanceMeters: nearestDistance,
        message: `You are not within range of any office (Nearest: ${nearestName}, ${distanceDisplay} away). Do you want to submit a Remote Check-Out?`,
      });
    }

    const isOutsideGeofence = !isInGeofence;
    const note = body.remoteReason || body.notes || (isOutsideGeofence ? "Remote Check-Out" : null);

    // 1. Immutable Raw Punch Audit Log
    await db.insert(attendancePunches).values({
      orgId: orgId || null,
      userId,
      punchType: "check_out",
      punchTime: now,
      latitude: body.latitude?.toString() || "0",
      longitude: body.longitude?.toString() || "0",
      distanceMeters: nearestDistance === Infinity ? null : nearestDistance,
      branchId: matchedBranch?.id || nearestBranch?.id || null,
      isOutsideGeofence,
      isMockLocation: false,
      deviceId: body.deviceId || null,
      note,
    });

    // 2. Daily Summary Record
    const [existing] = await db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.userId, userId), eq(attendanceRecords.date, today)))
      .limit(1);

    let workMinutes = 480; // default 8h
    if (existing?.clockInTime) {
      const [inH, inM] = existing.clockInTime.split(":").map(Number);
      const totalIn = inH * 60 + inM;
      const totalOut = now.getHours() * 60 + now.getMinutes();
      workMinutes = Math.max(0, totalOut - totalIn);
    }

    let record;
    if (existing) {
      const [updated] = await db
        .update(attendanceRecords)
        .set({
          clockOutTime: timeStr,
          workMinutes,
          updatedAt: new Date(),
        })
        .where(eq(attendanceRecords.id, existing.id))
        .returning();
      record = updated;
    } else {
      const [created] = await db
        .insert(attendanceRecords)
        .values({
          orgId: orgId || null,
          userId,
          branchId: matchedBranch?.id || nearestBranch?.id || null,
          date: today,
          clockOutTime: timeStr,
          workMinutes,
          status: isOutsideGeofence ? "remote" : "present",
          locationName: matchedBranch?.name || "Office Location",
          note,
        })
        .returning();
      record = created;
    }

    return reply.send({
      id: record.id,
      date: record.date,
      checkInTime: formatTimeString(record.clockInTime),
      checkOutTime: formatTimeString(record.clockOutTime),
      status: record.status === "late" ? "Late" : record.status === "remote" ? "Remote" : "Present",
      workHours: Number(((record.workMinutes || 0) / 60).toFixed(1)),
      locationName: record.locationName,
      isOutsideGeofence,
      note: record.note,
    });
  });

  // 5. Submit Attendance Regularization Request
  app.post("/regularize", async (request, reply) => {
    const userId = request.user.userId;
    const orgId = request.user.orgId;
    const body = request.body as {
      date: string;
      requestedClockIn?: string;
      requestedClockOut?: string;
      reason: string;
    };

    if (!body || !body.date || !body.reason) {
      return reply.status(400).send({
        statusCode: 400,
        message: "Date and reason are required fields for regularization.",
      });
    }

    // Check if user already has a pending regularization for this exact date
    const [existingPending] = await db
      .select()
      .from(attendanceRegularizations)
      .where(
        and(
          eq(attendanceRegularizations.userId, userId),
          eq(attendanceRegularizations.date, body.date),
          eq(attendanceRegularizations.status, "pending")
        )
      )
      .limit(1);

    if (existingPending) {
      return reply.status(409).send({
        statusCode: 409,
        message: "A pending regularization request already exists for this date.",
      });
    }

    // Check if an existing attendanceRecord exists for this date
    const [existingRecord] = await db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.userId, userId), eq(attendanceRecords.date, body.date)))
      .limit(1);

    const [created] = await db
      .insert(attendanceRegularizations)
      .values({
        orgId: orgId || null,
        userId,
        attendanceRecordId: existingRecord?.id || null,
        date: body.date,
        requestedClockIn: body.requestedClockIn || null,
        requestedClockOut: body.requestedClockOut || null,
        reason: body.reason,
        status: "pending",
      })
      .returning();

    return reply.status(201).send(created);
  });

  // 6. Get My Regularization Requests
  app.get("/regularize/my-requests", async (request, reply) => {
    const userId = request.user.userId;

    const requests = await db
      .select()
      .from(attendanceRegularizations)
      .where(eq(attendanceRegularizations.userId, userId))
      .orderBy(desc(attendanceRegularizations.createdAt));

    return reply.send(requests);
  });

  // 7. Get Pending Regularization Requests (Manager/HR/Admin)
  app.get(
    "/regularize/pending",
    { preHandler: [authorize(["admin", "hr", "manager"])] },
    async (request, reply) => {
      const orgId = request.user.orgId;
      const callerRole = request.user.role;
      const callerId = request.user.userId;

      const query = db
        .select({
          id: attendanceRegularizations.id,
          orgId: attendanceRegularizations.orgId,
          userId: attendanceRegularizations.userId,
          attendanceRecordId: attendanceRegularizations.attendanceRecordId,
          date: attendanceRegularizations.date,
          requestedClockIn: attendanceRegularizations.requestedClockIn,
          requestedClockOut: attendanceRegularizations.requestedClockOut,
          reason: attendanceRegularizations.reason,
          status: attendanceRegularizations.status,
          createdAt: attendanceRegularizations.createdAt,
          employeeName: users.name,
          employeeCode: users.employeeCode,
          departmentName: users.departmentName,
          managerId: users.managerId,
        })
        .from(attendanceRegularizations)
        .innerJoin(users, eq(attendanceRegularizations.userId, users.id))
        .where(
          and(
            orgId ? eq(attendanceRegularizations.orgId, orgId) : undefined,
            eq(attendanceRegularizations.status, "pending"),
            callerRole === "manager" ? eq(users.managerId, callerId) : undefined
          )
        )
        .orderBy(desc(attendanceRegularizations.createdAt));

      const pending = await query;
      return reply.send(pending);
    }
  );

  // 8. Review Regularization Request (Atomic Multi-Table Mutation)
  app.put(
    "/regularize/:id/review",
    { preHandler: [authorize(["admin", "hr", "manager"])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { status, comment } = request.body as {
        status: "approved" | "rejected";
        comment?: string;
      };
      const approverId = request.user.userId;
      const approverRole = request.user.role;
      const orgId = request.user.orgId;

      if (!status || !["approved", "rejected"].includes(status)) {
        return reply.status(400).send({
          statusCode: 400,
          message: "Invalid review decision. Status must be 'approved' or 'rejected'.",
        });
      }

      // Execute within an atomic SQL transaction
      const result = await db.transaction(async (tx) => {
        // Fetch request with requesting employee info for IDOR / authorization check
        const [reg] = await tx
          .select({
            request: attendanceRegularizations,
            employeeManagerId: users.managerId,
          })
          .from(attendanceRegularizations)
          .innerJoin(users, eq(attendanceRegularizations.userId, users.id))
          .where(
            and(
              eq(attendanceRegularizations.id, id),
              orgId ? eq(attendanceRegularizations.orgId, orgId) : undefined
            )
          )
          .limit(1);

        if (!reg) {
          throw { statusCode: 404, message: "Attendance regularization request not found." };
        }

        if (reg.request.status !== "pending") {
          throw {
            statusCode: 400,
            message: `This request has already been ${reg.request.status}.`,
          };
        }

        // Object-level authorization check: manager can only review their direct reports
        if (approverRole === "manager" && reg.employeeManagerId !== approverId) {
          throw {
            statusCode: 403,
            message: "You can only approve or reject regularizations for your direct team members.",
          };
        }

        // Update the regularization row
        const [updatedReg] = await tx
          .update(attendanceRegularizations)
          .set({
            status,
            approverId,
            approverComment: comment || null,
            reviewedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(attendanceRegularizations.id, id))
          .returning();

        // If approved, update or create attendance_records
        if (status === "approved") {
          const reqItem = reg.request;
          const [existingRecord] = await tx
            .select()
            .from(attendanceRecords)
            .where(
              and(
                eq(attendanceRecords.userId, reqItem.userId),
                eq(attendanceRecords.date, reqItem.date)
              )
            )
            .limit(1);

          const finalIn = reqItem.requestedClockIn || existingRecord?.clockInTime || "09:00:00";
          const finalOut = reqItem.requestedClockOut || existingRecord?.clockOutTime || "17:00:00";

          let workMinutes = 480;
          if (finalIn && finalOut) {
            const [inH, inM] = finalIn.split(":").map(Number);
            const [outH, outM] = finalOut.split(":").map(Number);
            workMinutes = Math.max(0, outH * 60 + outM - (inH * 60 + inM));
          }

          if (existingRecord) {
            await tx
              .update(attendanceRecords)
              .set({
                clockInTime: finalIn,
                clockOutTime: finalOut,
                workMinutes,
                status: "present",
                isRegularized: true,
                regularizedBy: approverId,
                regularizeReason: reqItem.reason,
                updatedAt: new Date(),
              })
              .where(eq(attendanceRecords.id, existingRecord.id));
          } else {
            await tx.insert(attendanceRecords).values({
              orgId: reqItem.orgId,
              userId: reqItem.userId,
              date: reqItem.date,
              clockInTime: finalIn,
              clockOutTime: finalOut,
              workMinutes,
              status: "present",
              isRegularized: true,
              regularizedBy: approverId,
              regularizeReason: reqItem.reason,
              source: "manual",
            });
          }
        }

        return updatedReg;
      });

      return reply.send({
        message: `Regularization request successfully ${status}.`,
        regularization: result,
      });
    }
  );

  // 9. Manager / HR Proxy Punch (Record attendance on behalf of employee with specific office branch)
  app.post<{
    Body: {
      targetUserId: string;
      punchType: "check_in" | "check_out";
      branchId: string;
      timestamp?: string; // HH:mm:ss
      date?: string; // YYYY-MM-DD
      reason: string;
      note?: string;
    };
  }>(
    "/proxy-punch",
    { preHandler: [authorize(["admin", "hr", "manager"])] },
    async (request, reply) => {
      const caller = request.user;
      const body = request.body;

      if (!body || !body.targetUserId || !body.branchId || !body.punchType || !body.reason) {
        return reply.status(400).send({
          statusCode: 400,
          message: "targetUserId, branchId, punchType ('check_in' | 'check_out'), and reason are required.",
        });
      }

      if (!["check_in", "check_out"].includes(body.punchType)) {
        return reply.status(400).send({
          statusCode: 400,
          message: "punchType must be either 'check_in' or 'check_out'.",
        });
      }

      // Verify target user exists and perform Object-Level Authorization (IDOR check)
      const [targetUser] = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.id, body.targetUserId),
            caller.orgId ? eq(users.orgId, caller.orgId) : undefined
          )
        )
        .limit(1);

      if (!targetUser) {
        return reply.status(404).send({
          statusCode: 404,
          message: "Employee not found in your organization.",
        });
      }

      // Manager authorization: If caller is manager, target user must report to them
      if (caller.role === "manager" && targetUser.managerId !== caller.userId) {
        return reply.status(403).send({
          statusCode: 403,
          message: "You can only submit proxy punches for your direct team members.",
        });
      }

      // Verify selected office branch exists and is active
      const [branch] = await db
        .select()
        .from(officeLocations)
        .where(
          and(
            eq(officeLocations.id, body.branchId),
            caller.orgId ? eq(officeLocations.orgId, caller.orgId) : undefined,
            eq(officeLocations.isActive, true)
          )
        )
        .limit(1);

      if (!branch) {
        return reply.status(400).send({
          statusCode: 400,
          message: "Selected office branch not found or is currently inactive.",
        });
      }

      const now = new Date();
      const targetDate = body.date || now.toISOString().split("T")[0];
      const timeStr = body.timestamp || `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

      const [inH, inM] = timeStr.split(":").map(Number);
      const isLate = body.punchType === "check_in" && (inH > 9 || (inH === 9 && inM > 15));
      const lateMinutes = isLate ? (inH - 9) * 60 + inM : 0;
      const punchStatus = isLate ? "late" : "present";

      const auditRemark = `[Proxy Punch by ${caller.name || caller.email} (${caller.role})] Reason: ${body.reason}${body.note ? ` - ${body.note}` : ""}`;

      // Atomic multi-table database transaction
      const result = await db.transaction(async (tx) => {
        // 1. Immutable Raw Punch Audit Log
        const [punch] = await tx
          .insert(attendancePunches)
          .values({
            orgId: caller.orgId || null,
            userId: targetUser.id,
            punchType: body.punchType,
            punchTime: now,
            latitude: branch.latitude,
            longitude: branch.longitude,
            distanceMeters: 0,
            branchId: branch.id,
            isOutsideGeofence: false,
            isMockLocation: false,
            note: auditRemark,
          })
          .returning();

        // 2. Fetch existing daily attendance record
        const [existingRecord] = await tx
          .select()
          .from(attendanceRecords)
          .where(
            and(
              eq(attendanceRecords.userId, targetUser.id),
              eq(attendanceRecords.date, targetDate)
            )
          )
          .limit(1);

        let finalRecord;
        if (body.punchType === "check_in") {
          if (existingRecord) {
            const [updated] = await tx
              .update(attendanceRecords)
              .set({
                clockInTime: timeStr,
                status: punchStatus,
                lateMinutes,
                latitude: branch.latitude,
                longitude: branch.longitude,
                locationName: branch.name,
                branchId: branch.id,
                source: "manual",
                isRegularized: true,
                regularizedBy: caller.userId,
                regularizeReason: auditRemark,
                note: body.note || auditRemark,
                updatedAt: new Date(),
              })
              .where(eq(attendanceRecords.id, existingRecord.id))
              .returning();
            finalRecord = updated;
          } else {
            const [created] = await tx
              .insert(attendanceRecords)
              .values({
                orgId: caller.orgId || null,
                userId: targetUser.id,
                branchId: branch.id,
                date: targetDate,
                clockInTime: timeStr,
                status: punchStatus,
                lateMinutes,
                workMinutes: 0,
                latitude: branch.latitude,
                longitude: branch.longitude,
                locationName: branch.name,
                source: "manual",
                isRegularized: true,
                regularizedBy: caller.userId,
                regularizeReason: auditRemark,
                note: body.note || auditRemark,
              })
              .returning();
            finalRecord = created;
          }
        } else {
          // check_out
          const clockIn = existingRecord?.clockInTime;
          let workMinutes = 480;
          if (clockIn) {
            const [cInH, cInM] = clockIn.split(":").map(Number);
            workMinutes = Math.max(0, inH * 60 + inM - (cInH * 60 + cInM));
          }

          if (existingRecord) {
            const [updated] = await tx
              .update(attendanceRecords)
              .set({
                clockOutTime: timeStr,
                workMinutes,
                latitude: branch.latitude,
                longitude: branch.longitude,
                locationName: branch.name,
                branchId: branch.id,
                source: "manual",
                isRegularized: true,
                regularizedBy: caller.userId,
                regularizeReason: auditRemark,
                note: body.note || auditRemark,
                updatedAt: new Date(),
              })
              .where(eq(attendanceRecords.id, existingRecord.id))
              .returning();
            finalRecord = updated;
          } else {
            const [created] = await tx
              .insert(attendanceRecords)
              .values({
                orgId: caller.orgId || null,
                userId: targetUser.id,
                branchId: branch.id,
                date: targetDate,
                clockOutTime: timeStr,
                status: "present",
                workMinutes,
                latitude: branch.latitude,
                longitude: branch.longitude,
                locationName: branch.name,
                source: "manual",
                isRegularized: true,
                regularizedBy: caller.userId,
                regularizeReason: auditRemark,
                note: body.note || auditRemark,
              })
              .returning();
            finalRecord = created;
          }
        }

        return { punch, record: finalRecord };
      });

      return reply.status(200).send({
        message: `Successfully recorded proxy ${body.punchType === "check_in" ? "check-in" : "check-out"} for ${targetUser.name} at ${branch.name}.`,
        punch: result.punch,
        attendanceRecord: {
          id: result.record.id,
          date: result.record.date,
          checkInTime: formatTimeString(result.record.clockInTime),
          checkOutTime: formatTimeString(result.record.clockOutTime),
          status: result.record.status,
          locationName: result.record.locationName,
          workHours: Number(((result.record.workMinutes || 0) / 60).toFixed(1)),
          isRegularized: result.record.isRegularized,
        },
      });
    }
  );
};
