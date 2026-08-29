import { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;

const globalForRedis = globalThis as unknown as { redis?: RedisClient };

export const redis =
  globalForRedis.redis ??
  createClient({ 
    url: process.env.REDIS_URL,
    RESP: 2
  });

redis.on("error", (err) => {
  console.error("Redis Client Error:", err);
});

if (!redis.isOpen) {
  redis.connect().catch((err) => {
    console.error("Failed to connect to Redis:", err);
  });
}

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

export default redis;