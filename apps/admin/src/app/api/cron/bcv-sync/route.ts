import { NextResponse } from "next/server";
import { MarketOSRepository } from "@marketos/database";

export const dynamic = "force-dynamic";

/**
 * Automated Cron / Webhook Endpoint for Synchronizing BCV Exchange Rate
 * Can be called by Vercel Cron, external scheduled job, or manual health monitor
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantIdParam = searchParams.get("tenantId");

    const tenants = await MarketOSRepository.getAllTenants();
    const activeTenants = tenants.filter((t) => t.status === "active");

    const results = [];

    if (tenantIdParam) {
      const rate = await MarketOSRepository.syncBcvRateFromApi(tenantIdParam);
      results.push({ tenantId: tenantIdParam, rate });
    } else {
      for (const tenant of activeTenants) {
        try {
          const rate = await MarketOSRepository.syncBcvRateFromApi(tenant.id);
          results.push({ tenantId: tenant.id, rate: rate.value });
        } catch (err) {
          console.error(`Failed to sync BCV rate for tenant ${tenant.id}:`, err);
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
