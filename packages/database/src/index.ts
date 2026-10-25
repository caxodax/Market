import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_ANON_KEY,
} from "./server.ts";

/**
 * Creates an authenticated Supabase client for Server/Browser
 */
export function createSupabaseClient(
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL,
  supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY
) {
  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Creates a Supabase Admin client with service_role key
 * (Only to be used in secure Server-side contexts)
 */
export function createSupabaseAdminClient(
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL,
  supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  if (!supabaseServiceRoleKey) {
    throw new Error("[MarketOS Database] SUPABASE_SERVICE_ROLE_KEY is required for admin client.");
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export * from "./client.ts";
export * from "./server.ts";
export * from "./circuit-breaker.ts";
export * from "./services.ts";
export * from "./repositories/index.ts";
export * from "./mock-data.ts";
export * from "@marketos/types";

