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

async function runWithTimeout<T>(promise: Promise<T>, ms = 800): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * Get cached value from Upstash Redis (with 800ms fail-fast protection)
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const data = await runWithTimeout(redis.get<T>(key), 800);
    return data;
  } catch (e) {
    console.warn(`[Redis Cache] Skipped key ${key} (${e instanceof Error ? e.message : e})`);
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
    await runWithTimeout(redis.set(key, value, { ex: ttlSeconds }), 800);
  } catch (e) {
    console.warn(`[Redis Cache] Write skipped for ${key} (${e instanceof Error ? e.message : e})`);
  }
}
