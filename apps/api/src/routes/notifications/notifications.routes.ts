import type { FastifyPluginAsync } from "fastify";
import { getTenantClient } from "../../db/client.js";

export const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /notifications — user's own notifications
  fastify.get("/", async (request, reply) => {
    const userId = request.user.sub;
    const { unread } = request.query as { unread?: string };
    const client = await getTenantClient(request.tenantSlug);
    try {
      let sql = `SELECT * FROM notifications WHERE user_id = $1`;
      if (unread === "true") sql += ` AND read = FALSE`;
      sql += ` ORDER BY created_at DESC LIMIT 50`;
      const { rows } = await client.query(sql, [userId]);
      return reply.send({ data: rows });
    } finally {
      client.release();
    }
  });

  // PATCH /notifications/:id/read
  fastify.patch("/:id/read", async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.sub;
    const client = await getTenantClient(request.tenantSlug);
    try {
      await client.query(
        `UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2`,
        [id, userId],
      );
      return reply.send({ data: { message: "Marked as read" } });
    } finally {
      client.release();
    }
  });

  // PATCH /notifications/read-all
  fastify.patch("/read-all", async (request, reply) => {
    const userId = request.user.sub;
    const client = await getTenantClient(request.tenantSlug);
    try {
      await client.query(
        `UPDATE notifications SET read = TRUE WHERE user_id = $1`,
        [userId],
      );
      return reply.send({ data: { message: "All marked as read" } });
    } finally {
      client.release();
    }
  });
};
