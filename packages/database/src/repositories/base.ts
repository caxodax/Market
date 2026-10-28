import { isSupabaseOffline } from "../circuit-breaker.ts";
import { createServerComponentClient } from "../server.ts";

export function isUuid(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

export function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export { isLiveDatabaseConfigured } from "../mock-data.ts";

export function getSupabase() {
  if (isSupabaseOffline()) {
    return null;
  }

  try {
    return createServerComponentClient();
  } catch (e) {
    console.warn("[MarketOS Repository] Could not initialize Supabase server client:", e);
  }
  return null;
}

