import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_ANON_KEY,
  DEFAULT_SUPABASE_SERVICE_ROLE_KEY,
} from "./server";

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
  supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SUPABASE_SERVICE_ROLE_KEY
) {
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export * from "./client";
export * from "./server";
export * from "./circuit-breaker";
export * from "./services";
export * from "./mock-data";
export * from "@marketos/types";

