import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { Redis } from "ioredis";
import { env } from "../config/env.js";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

const redisPluginImpl: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

  await redis.connect();
  redis.on("error", (err) => fastify.log.error({ err }, "Redis error"));

  fastify.decorate("redis", redis);
  fastify.addHook("onClose", async () => redis.quit());
};

export const redisPlugin = fp(redisPluginImpl, { name: "redis" });
