/**
 * Circuit Breaker pattern for Supabase & External Services
 * In serverless environments, in-memory process-level circuit breakers trip on transient client
 * aborts/latency and cause cascading outages with unwanted mock-data fallbacks.
 * Disabled in favor of standard HTTP timeouts and Next.js stale-while-revalidate error preservation.
 */

export function isSupabaseOffline(): boolean {
  return false;
}

export function markSupabaseOffline(reason?: any): void {
  // No-op: do not block subsequent serverless queries across instances
}

export function resetSupabaseCircuit(): void {
  // No-op
}
