import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { isSupabaseOffline, markSupabaseOffline } from "./circuit-breaker";

/**
 * Creates a Supabase client for Server Components, Server Actions, or Route Handlers
 * Equipped with fail-fast 1.5s timeout and automatic circuit breaker
 */
export function createServerComponentClient(cookieStore?: {
  get: (name: string) => { value: string } | undefined;
  set?: (name: string, value: string, options: CookieOptions) => void;
  remove?: (name: string, options: CookieOptions) => void;
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  return createServerClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: async (input, init) => {
        if (isSupabaseOffline()) {
          throw new Error("Supabase is currently offline (Circuit Breaker active)");
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);

        try {
          const res = await fetch(input, {
            ...init,
            signal: init?.signal || controller.signal,
          });
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
