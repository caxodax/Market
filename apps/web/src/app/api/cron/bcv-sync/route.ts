import { NextResponse } from "next/server";
import { MarketOSRepository } from "@marketos/database";

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

    // Verify secret if CRON_SECRET is set in environment
    if (cronSecret) {
      const isBearerValid = authHeader === `Bearer ${cronSecret}`;
      const isParamValid = secretParam === cronSecret;
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
      results.push({
        tenantId: tenantIdParam,
        rate: rate.value,
        source: rate.source,
      });
    } else {
      // Sync default tenant first
      const defaultTenantId = process.env.DEFAULT_TENANT_ID || "shop-market-ca";
      try {
        const defaultRate =
          await MarketOSRepository.syncBcvRateFromApi(defaultTenantId);
        results.push({
          tenantId: defaultTenantId,
          rate: defaultRate.value,
          source: defaultRate.source,
        });
      } catch (e) {
        console.error("Failed to sync default tenant rate:", e);
      }

      // Sync remaining active tenants
      for (const tenant of activeTenants) {
        if (tenant.id === defaultTenantId) continue;
        try {
          const rate = await MarketOSRepository.syncBcvRateFromApi(tenant.id);
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
