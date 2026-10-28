import { NextResponse } from "next/server";
import { MarketOSRepository } from "@marketos/database";
import { invalidateExchangeRateCache } from "../../../../lib/cached-queries";

export const dynamic = "force-dynamic";

/**
 * Automated Cron / Webhook Endpoint for Synchronizing BCV Exchange Rate into Supabase
 * Executed daily (e.g. 5:00 PM VET / 21:00 UTC) via Vercel Cron, pg_cron, or external monitor.
 */
export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const { searchParams } = new URL(request.url);
    const secretParam = searchParams.get("secret");
    const authHeader = request.headers.get("authorization");

    // AgentShield: Strict Token Authentication (Bearer token or ?secret= parameter)
    // Never trust User-Agent header (easily spoofable)
    const isAuthorized = Boolean(cronSecret)
      ? authHeader === `Bearer ${cronSecret}` || secretParam === cronSecret
      : process.env.NODE_ENV !== "production";

    if (!isAuthorized) {
      if (!cronSecret && process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { error: "Cron execution disabled: CRON_SECRET is not configured in production" },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantIdParam = searchParams.get("tenantId");
    const tenants = await MarketOSRepository.getAllTenants();
    const activeTenants = tenants.filter((t) => t.status === "active");

    const results = [];

    if (tenantIdParam) {
      const rate = await MarketOSRepository.syncBcvRateFromApi(tenantIdParam);
      invalidateExchangeRateCache(tenantIdParam);
      results.push({
        tenantId: tenantIdParam,
        rate: rate.value,
        source: rate.source,
      });
    } else {
      for (const tenant of activeTenants) {
        try {
          const activeModules = await MarketOSRepository.getTenantActiveModuleIds(tenant.id);
          if (!activeModules.includes("local_venezuela")) {
            continue;
          }

          const rate = await MarketOSRepository.syncBcvRateFromApi(tenant.id);
          invalidateExchangeRateCache(tenant.id);
          results.push({
            tenantId: tenant.id,
            rate: rate.value,
            source: rate.source,
          });
        } catch (err) {
          console.error(
            `Failed to sync BCV rate for tenant ${tenant.id}:`,
            err
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      syncedCount: results.length,
      details: results,
    });
  } catch (error) {
    console.error("BCV Sync Cron Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
