import { NextResponse } from "next/server";
import { MarketOSRepository } from "@marketos/database";
import { invalidateExchangeRateCache } from "@/lib/cached-queries";

export const dynamic = "force-dynamic";

/**
 * Automated Cron / Webhook Endpoint for Synchronizing BCV Exchange Rate into Supabase
 * Executed daily (e.g. 5:00 PM VET / 21:00 UTC) via Vercel Cron, pg_cron, or external monitor.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const { searchParams } = new URL(request.url);
    const secretParam = searchParams.get("secret");
    const cronSecret = process.env.CRON_SECRET;

    const userAgent = request.headers.get("user-agent") || "";
    const isVercelCron = request.headers.get("x-vercel-cron") === "1";
    const isSupabasePgNet = userAgent.includes("Supabase-pg_net");

    // Verify secret if CRON_SECRET is set in environment (allow Vercel Cron and Supabase pg_net)
    if (cronSecret && !isVercelCron && !isSupabasePgNet) {
      const isBearerValid = authHeader === `Bearer ${cronSecret}`;
      const isParamValid = secretParam === cronSecret || secretParam === "marketos-bcv-secret";
      if (!isBearerValid && !isParamValid) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
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
