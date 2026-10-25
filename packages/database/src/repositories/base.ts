import { isSupabaseOffline } from "../circuit-breaker.ts";
import { createServerComponentClient } from "../server.ts";

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
