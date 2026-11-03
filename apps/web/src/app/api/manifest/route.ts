import { NextResponse } from "next/server";
import { MarketOSRepository } from "@marketos/database";

export const dynamic = "force-dynamic";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * MarketOS — Dynamic Multi-Tenant PWA Web App Manifest Endpoint
 * ═══════════════════════════════════════════════════════════════════════
 * Provee un manifiesto W3C aislado por comercio con identidad única (id),
 * nombre de marca, icono del comercio, colores y scope segmentado.
 * Permite que cada comercio sea instalado como una PWA independiente en
 * Android, iOS y Desktop sin colisionar con otras tiendas de la plataforma.
 * ═══════════════════════════════════════════════════════════════════════
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let tenantParam = searchParams.get("tenant")?.trim().toLowerCase();

    // Si no viene en la query, intentar deducir por el Referer
    if (!tenantParam) {
      const referer = request.headers.get("referer");
      if (referer) {
        try {
          const refUrl = new URL(referer);
          tenantParam = refUrl.searchParams.get("tenant")?.trim().toLowerCase() || undefined;
          if (!tenantParam && refUrl.pathname.startsWith("/t/")) {
            tenantParam = refUrl.pathname.split("/")[2]?.trim().toLowerCase() || undefined;
          }
        } catch {}
      }
    }

    const tenantIdentifier = tenantParam || process.env.DEFAULT_TENANT_ID || "shop-market-ca";
    const tenant = await MarketOSRepository.getTenant(tenantIdentifier);
    const activeTenantId = tenant?.id || tenantIdentifier;
    const settings = await MarketOSRepository.getTenantSettings(activeTenantId);

    const tenantSlug = tenant?.slug || activeTenantId;
    const businessName = settings.business_name || (tenant?.name || "Comercio Digital");
    const primaryColor = settings.primary_color || "#DC2626";
    const iconUrl = settings.logo_url || "/icon-512.png";
    const iconType = iconUrl.endsWith(".svg")
      ? "image/svg+xml"
      : iconUrl.endsWith(".webp") || iconUrl.startsWith("data:image/webp")
      ? "image/webp"
      : "image/png";

    const manifestData = {
      name: `${businessName} | Catálogo Digital`,
      short_name: businessName,
      description:
        settings.operational_settings?.announcement_banner ||
        `Catálogo digital y pedidos directos en ${businessName}`,
      id: `/t/${encodeURIComponent(tenantSlug)}`,
      start_url: `/t/${encodeURIComponent(tenantSlug)}?source=pwa`,
      scope: `/t/${encodeURIComponent(tenantSlug)}`,
      display: "standalone",
      orientation: "portrait",
      background_color: "#FFFFFF",
      theme_color: primaryColor,
      categories: ["shopping", "business"],
      icons: [
        {
          src: iconUrl,
          sizes: "192x192",
          type: iconType,
          purpose: "any",
        },
        {
          src: iconUrl,
          sizes: "192x192",
          type: iconType,
          purpose: "maskable",
        },
        {
          src: iconUrl,
          sizes: "512x512",
          type: iconType,
          purpose: "any",
        },
        {
          src: iconUrl,
          sizes: "512x512",
          type: iconType,
          purpose: "maskable",
        },
        {
          src: iconUrl,
          sizes: "180x180",
          type: iconType,
        },
      ],
    };

    return NextResponse.json(manifestData, {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error("[MarketOS Manifest Route] Error generating dynamic manifest:", error);
    return NextResponse.json(
      {
        name: "MarketOS | Catálogo Digital",
        short_name: "MarketOS",
        id: "marketos-default",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#FFFFFF",
        theme_color: "#DC2626",
      },
      {
        headers: {
          "Content-Type": "application/manifest+json",
          ...corsHeaders,
        },
      }
    );
  }
}
