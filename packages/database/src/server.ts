import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { isSupabaseOffline, markSupabaseOffline, resetSupabaseCircuit } from "./circuit-breaker.ts";

export const DEFAULT_SUPABASE_URL = "https://xiklunkmdpqzlhmrfkql.supabase.co";
export const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_TFxsLCzYcvAAXM3yf65CuA_excYmDR7";

/**
 * Creates a Supabase client for Server Components, Server Actions, or Route Handlers
 * When cookieStore is passed, uses user session; when omitted, uses service_role for backend repository queries.
 */
export function createServerComponentClient(cookieStore?: {
  get: (name: string) => { value: string } | undefined;
  set?: (name: string, value: string, options: CookieOptions) => void;
  remove?: (name: string, options: CookieOptions) => void;
}) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    DEFAULT_SUPABASE_URL;

  // For backend repository access without user session, prioritize SERVICE_ROLE_KEY from environment
  const supabaseKey = cookieStore
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      DEFAULT_SUPABASE_ANON_KEY
    : process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      DEFAULT_SUPABASE_ANON_KEY;

  return createServerClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: async (input, init) => {
        if (isSupabaseOffline()) {
          throw new Error("Supabase is temporarily offline (Circuit Breaker active)");
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        try {
          const res = await fetch(input, {
            ...init,
            signal: init?.signal || controller.signal,
          });
          if (res.ok) {
            resetSupabaseCircuit();
          }
          return res;
        } catch (err: any) {
          markSupabaseOffline(err);
          throw err;
        } finally {
          clearTimeout(timeoutId);
        }
      },
    },
    cookies: {
      get(name: string) {
        return cookieStore?.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore?.set?.(name, value, options);
        } catch {
          // Can happen in Server Components where cookies cannot be mutated
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore?.remove?.(name, options);
        } catch {
          // Can happen in Server Components where cookies cannot be mutated
        }
      },
    },
  });
}
