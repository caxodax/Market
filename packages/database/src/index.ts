import { createClient } from "@supabase/supabase-js";

/**
 * Creates an authenticated Supabase client for Server/Browser
 */
export function createSupabaseClient(
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
) {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      "[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Creates a Supabase Admin client with service_role key
 * (Only to be used in secure Server-side contexts)
 */
export function createSupabaseAdminClient(
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "[Supabase Admin] Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL"
    );
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export * from "./client";
export * from "./server";
export * from "./services";
export * from "./mock-data";
export * from "@marketos/types";

