import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import websocket, { type WebSocket } from "@fastify/websocket";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { JwtPayload } from "./auth.js";
import type { WsMessage } from "@mediscala/shared";

// Connected clients keyed by userId
const clients = new Map<string, Set<WebSocket>>();

declare module "fastify" {
  interface FastifyInstance {
    wsClients: typeof clients;
    sendToUser: (userId: string, message: WsMessage) => void;
    broadcastToTenant: (
      schemaName: string,
      message: WsMessage,
      userIds?: string[],
    ) => void;
  }
}

const wsPluginImpl: FastifyPluginAsync = async (fastify) => {
  await fastify.register(websocket);

  fastify.decorate("wsClients", clients);

  fastify.decorate("sendToUser", (userId: string, message: WsMessage) => {
    const userSockets = clients.get(userId);
    if (!userSockets) return;
    const payload = JSON.stringify(message);
    for (const ws of userSockets) {
      if (ws.readyState === ws.OPEN) ws.send(payload);
    }
  });

  fastify.decorate(
    "broadcastToTenant",
    (schemaName: string, message: WsMessage, userIds?: string[]) => {
      const payload = JSON.stringify(message);
      const targets = userIds ?? [...clients.keys()];
      for (const userId of targets) {
        const sockets = clients.get(userId);
        if (!sockets) continue;
        for (const ws of sockets) {
          if (ws.readyState === ws.OPEN) ws.send(payload);
        }
      }
    },
  );

  fastify.get("/ws", { websocket: true }, (socket, request) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      socket.close(1008, "Missing token");
      return;
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    } catch {
      socket.close(1008, "Invalid token");
      return;
    }

    const userId = payload.sub;
    if (!clients.has(userId)) clients.set(userId, new Set());
    clients.get(userId)!.add(socket);

    fastify.log.info({ userId }, "WS client connected");

    // Heartbeat
    const interval = setInterval(() => {
      if (socket.readyState === socket.OPEN) {
        socket.send(
          JSON.stringify({
            event: "ping",
            data: null,
            timestamp: new Date().toISOString(),
          }),
        );
      }
    }, 30_000);

    socket.on("close", () => {
      clients.get(userId)?.delete(socket);
      if (clients.get(userId)?.size === 0) clients.delete(userId);
      clearInterval(interval);
      fastify.log.info({ userId }, "WS client disconnected");
    });
  });
};

export const wsPlugin = fp(wsPluginImpl, { name: "websocket" });
