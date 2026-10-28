import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET } from "../../../../apps/web/src/app/api/cron/bcv-sync/route.ts";

describe("AgentShield: BCV Cron Authentication & Authorization", () => {
  const TEST_SECRET = "super-secret-token-bcv-998877";
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.CRON_SECRET = TEST_SECRET;
    process.env.NODE_ENV = "production";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            getCountryConversions: {
              conversionRates: [
                { official: true, rateCurrency: { code: "USD" }, baseValue: 887.3 },
              ],
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("strictly blocks spoofed User-Agent: Supabase-pg_net without valid secret (401)", async () => {
    const req = new Request("http://localhost:3000/api/cron/bcv-sync", {
      method: "GET",
      headers: {
        "User-Agent": "Supabase-pg_net-MarketOS",
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("strictly blocks invalid Bearer token (401)", async () => {
    const req = new Request("http://localhost:3000/api/cron/bcv-sync", {
      method: "GET",
      headers: {
        Authorization: "Bearer invalid-spoofed-token",
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("strictly blocks invalid ?secret= query parameter (401)", async () => {
    const req = new Request("http://localhost:3000/api/cron/bcv-sync?secret=wrong-secret", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("blocks cron execution with 403 Forbidden when CRON_SECRET is not configured in production", async () => {
    delete process.env.CRON_SECRET;
    const req = new Request("http://localhost:3000/api/cron/bcv-sync", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("CRON_SECRET is not configured in production");
  });

  it("authenticates legitimate caller with Authorization: Bearer <secret> (200)", async () => {
    const req = new Request("http://localhost:3000/api/cron/bcv-sync?tenantId=shop-market-ca", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${TEST_SECRET}`,
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("authenticates legitimate caller with ?secret=<secret> parameter (200)", async () => {
    const req = new Request(`http://localhost:3000/api/cron/bcv-sync?tenantId=shop-market-ca&secret=${TEST_SECRET}`, {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});
