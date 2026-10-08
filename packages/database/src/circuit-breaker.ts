/**
 * Circuit Breaker pattern for Supabase & External Services
 * Prevents hanging Next.js SSR requests when network/Cloudflare/Supabase is unreachable or degraded.
 */

let offlineUntil = 0;

export function isSupabaseOffline(): boolean {
  return Date.now() < offlineUntil;
}

export function markSupabaseOffline(reason?: any): void {
  // Trip circuit breaker for 60 seconds
  offlineUntil = Date.now() + 60_000;
  console.warn(
    `[MarketOS Circuit Breaker] Supabase is unreachable or timed out (${
      reason?.message || reason || "network timeout"
    }). Seamlessly falling back to local resilient database state for 60s.`
  );
}

export function resetSupabaseCircuit(): void {
  offlineUntil = 0;
}
