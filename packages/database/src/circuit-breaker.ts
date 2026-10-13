/**
 * Circuit Breaker pattern for Supabase & External Services
 * Prevents hanging Next.js SSR requests when network/Cloudflare/Supabase is unreachable or degraded.
 */

let offlineUntil = 0;
let consecutiveFailures = 0;

export function isSupabaseOffline(): boolean {
  return Date.now() < offlineUntil;
}

export function markSupabaseOffline(reason?: any): void {
  consecutiveFailures += 1;
  // Trip for 5 seconds on transient glitches rather than locking out for 60 seconds
  offlineUntil = Date.now() + 5_000;
  console.warn(
    `[MarketOS Circuit Breaker] Supabase latency/connectivity warning (${
      reason?.message || reason || "network issue"
    }). Pausing calls for 5s (failure count: ${consecutiveFailures}).`
  );
}

export function resetSupabaseCircuit(): void {
  offlineUntil = 0;
  consecutiveFailures = 0;
}
