import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../db/index";
import { announcements, announcementReads } from "../../db/schema/announcements";
import { authenticate } from "../../middleware/auth";

export const announcementsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Public or Authenticated
  app.get("/", async (request, reply) => {
    let currentUserId: string | null = null;
    try {
      await request.jwtVerify();
      currentUserId = (request.user as any)?.userId;
    } catch {
      // Allow unauthenticated reading as fallback
    }

    const list = await db
      .select()
      .from(announcements)
      .where(eq(announcements.status, "Published"))
      .orderBy(desc(announcements.createdAt));

    let userReadIds = new Set<string>();
    if (currentUserId) {
      const reads = await db
        .select()
        .from(announcementReads)
        .where(eq(announcementReads.userId, currentUserId));
      userReadIds = new Set(reads.map((r) => r.announcementId));
    }

    const mapped = list.map((a) => ({
      id: a.id,
      authorityGroup: a.authorityGroup,
      authorityCode: a.authorityCode,
      directiveNo: a.directiveNo,
      title: a.title,
      summary: a.summary,
      fullBody: a.fullBody,
      date: a.date,
      issuer: a.issuer,
      priority: a.priority,
      isRead: userReadIds.has(a.id),
    }));

    return reply.send(mapped);
  });

  // Mark as read
  app.post<{
    Params: { id: string };
  }>("/:id/read", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.userId;

    const [existing] = await db
      .select()
      .from(announcementReads)
      .where(and(eq(announcementReads.announcementId, id), eq(announcementReads.userId, userId)))
      .limit(1);

    if (!existing) {
      await db.insert(announcementReads).values({
        announcementId: id,
        userId,
      });
    }

    return reply.send({ success: true, message: "Announcement marked as read" });
  });
};
