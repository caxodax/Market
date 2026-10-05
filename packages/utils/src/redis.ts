import { Redis } from "@upstash/redis";

let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  try {
    redisClient = new Redis({
      url,
      token,
    });
    return redisClient;
  } catch (error) {
    console.warn("[Redis] Failed to initialize Upstash Redis:", error);
    return null;
  }
}

/**
 * Get cached value from Upstash Redis
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const data = await redis.get<T>(key);
    return data;
  } catch (e) {
    console.warn(`[Redis Cache] Error getting key ${key}:`, e);
    return null;
  }
}

/**
 * Set cached value in Upstash Redis with optional TTL in seconds
 */
export async function cacheSet(
  key: string,
  value: any,
  ttlSeconds = 3600
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (e) {
    console.warn(`[Redis Cache] Error setting key ${key}:`, e);
  }
}
