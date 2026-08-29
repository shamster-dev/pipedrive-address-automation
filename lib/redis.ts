import { createClient, RedisClientType } from "redis";

const globalForRedis = globalThis as unknown as { redis?: RedisClientType };

export const redis =
  globalForRedis.redis ??
  createClient({ url: process.env.REDIS_URL });

if (!redis.isOpen) {
  redis.connect().catch(console.error);
}

console.log("redis connected")

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

export default redis;