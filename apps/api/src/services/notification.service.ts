import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import type { NotificationType } from "@mediscala/shared";
import { getTenantClient } from "../db/client.js";

const expo = new Expo({ useFcmV1: true });

interface SendNotificationOptions {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  pushToken?: string | null;
}

export const notificationService = {
  async sendToUser(
    fastify: any,
    tenantSlug: string,
    opts: SendNotificationOptions,
  ) {
    const { userId, type, title, message, metadata, pushToken } = opts;

    // 1. Persist in DB
    const client = await getTenantClient(tenantSlug);
    try {
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, metadata) VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          type,
          title,
          message,
          metadata ? JSON.stringify(metadata) : null,
        ],
      );
    } finally {
      client.release();
    }

    // 2. Real-time via WebSocket
    if (fastify.sendToUser) {
      fastify.sendToUser(userId, {
        event: "notification",
        data: { type, title, message, metadata },
        timestamp: new Date().toISOString(),
      });
    }

    // 3. Push notification via Expo
    if (pushToken && Expo.isExpoPushToken(pushToken)) {
      const pushMessage: ExpoPushMessage = {
        to: pushToken,
        title,
        body: message,
        data: { type, ...metadata },
        sound: "default",
      };
      try {
        const chunks = expo.chunkPushNotifications([pushMessage]);
        for (const chunk of chunks) {
          const tickets = await expo.sendPushNotificationsAsync(chunk);
          fastify.log.info({ tickets }, "Push notification sent");
        }
      } catch (err) {
        fastify.log.error({ err, userId }, "Failed to send push notification");
      }
    }
  },
};
