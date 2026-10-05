import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase client for Client Components in the browser
 */
export function createClientComponentClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  return createBrowserClient(supabaseUrl, supabaseKey);
}
