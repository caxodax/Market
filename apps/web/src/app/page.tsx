import React from "react";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  getCachedTenant,
  getCachedTenantSettings,
  getCachedCategories,
  getCachedProducts,
  getCachedStores,
  getCachedExchangeRate,
  getCachedDeliveryZones,
  getCachedTenantActiveModuleIds,
  getCachedCoupons,
} from "../lib/cached-queries";
import { MarketOSRepository } from "@marketos/database";
import { StorefrontPage } from "../components/storefront-page";
import { SuspendedStorePage } from "../components/suspended-store-page";
import { AnalyticsTracker } from "@marketos/plugin-analytics";

export const dynamic = "force-dynamic";

interface HomePageProps {
  searchParams: Promise<{ tenant?: string }>;
}

async function resolveTenantIdentifier(explicitParam?: string): Promise<string> {
  if (explicitParam) return explicitParam;
  try {
    const headersList = await headers();
    const host = headersList.get("host")?.split(":")[0].toLowerCase() || "";
    const platformDomain = (process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "").toLowerCase();
    const isPlatformDomain =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".vercel.app") ||
      (Boolean(platformDomain) && host === platformDomain);

    if (!isPlatformDomain && host) {
      if (platformDomain && host.endsWith(`.${platformDomain}`)) {
        return host.replace(`.${platformDomain}`, "");
      }
      return host;
    }
  } catch {
    // ignore
  }
  return process.env.DEFAULT_TENANT_ID || "shop-market-ca";
}

export async function generateViewport({
  searchParams,
}: HomePageProps): Promise<Viewport> {
  const params = await searchParams;
  const tenantSlugOrId = await resolveTenantIdentifier(params?.tenant);

  let tenant = await getCachedTenant(tenantSlugOrId);
  if (!tenant) {
    tenant = await MarketOSRepository.getTenant(tenantSlugOrId);
  }
  const activeTenantId = tenant?.id || tenantSlugOrId;
  const settings = await getCachedTenantSettings(activeTenantId);

  return {
    themeColor: settings?.primary_color || "#DC2626",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
    interactiveWidget: "resizes-content",
  };
}

export async function generateMetadata({
  searchParams,
}: HomePageProps): Promise<Metadata> {
  const params = await searchParams;
  const tenantSlugOrId = await resolveTenantIdentifier(params?.tenant);

  let tenant = await getCachedTenant(tenantSlugOrId);
  if (!tenant) {
    tenant = await MarketOSRepository.getTenant(tenantSlugOrId);
  }
  if (!tenant) {
    return {
      title: "Comercio no encontrado | MarketOS",
      description: "El comercio solicitado no existe o no se encuentra activo.",
    };
  }

  const activeTenantId = tenant.id;
  const tenantSlug = tenant.slug || activeTenantId;
  const settings = await getCachedTenantSettings(activeTenantId);

  const title = `${settings.business_name} | Catálogo & Delivery`;
  const description =
    settings.operational_settings?.announcement_banner ||
    `Catálogo digital, pedidos directos y delivery en ${settings.business_name}`;
  const iconUrl = settings.logo_url || "/brand/logo.png";

  return {
    title,
    description,
    manifest: `/api/manifest?tenant=${encodeURIComponent(tenantSlug)}&v=2`,
    appleWebApp: {
      capable: true,
      title: settings.business_name,
      statusBarStyle: "default",
    },
    icons: {
      icon: iconUrl,
      apple: iconUrl,
      shortcut: iconUrl,
    },
    openGraph: {
      title,
      description,
      siteName: settings.business_name,
      images: [
        {
          url: iconUrl,
          width: 512,
          height: 512,
          alt: settings.business_name,
        },
      ],
    },
  };
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  if (params?.tenant) {
    const cleanTenant = params.tenant.trim().toLowerCase();
    redirect(`/t/${encodeURIComponent(cleanTenant)}`);
  }

  const tenantSlugOrId = await resolveTenantIdentifier(params?.tenant);

  let tenant = await getCachedTenant(tenantSlugOrId);
  if (!tenant) {
    tenant = await MarketOSRepository.getTenant(tenantSlugOrId);
  }
  if (!tenant) {
    notFound();
  }

  const activeTenantId = tenant.id;

  // Redirigir la raíz del dominio plataforma a /t/[tenantSlug] para aislar scopes de PWA
  const headersList = await headers();
  const host = headersList.get("host")?.split(":")[0].toLowerCase() || "";
  const platformDomain = (process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "").toLowerCase();
  const isPlatformDomain =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".vercel.app") ||
    (Boolean(platformDomain) && host === platformDomain);

  if (isPlatformDomain) {
    const targetSlug = tenant.slug || tenant.id || "shop-market";
    redirect(`/t/${encodeURIComponent(targetSlug)}`);
  }

  // BLOQUEO INMEDIATO: Si la tienda ha sido suspendida por el Super Admin o está inactiva
  if (tenant.status === "suspended" || tenant.status === "inactive") {
    const settings = await getCachedTenantSettings(activeTenantId);
    return <SuspendedStorePage settings={settings} tenant={tenant} />;
  }

  // Fetch tenant data concurrently from Next.js Edge Data Cache (<15ms latency, 0 Postgres queries on repeat visits)
  const [
    settings,
    categories,
    products,
    stores,
    exchangeRate,
    deliveryZones,
    activeModuleIds,
    modifierGroups,
    coupons,
  ] = await Promise.all([
    getCachedTenantSettings(activeTenantId),
    getCachedCategories(activeTenantId),
    getCachedProducts(activeTenantId),
    getCachedStores(activeTenantId),
    getCachedExchangeRate(activeTenantId),
    getCachedDeliveryZones(activeTenantId),
    getCachedTenantActiveModuleIds(activeTenantId),
    MarketOSRepository.getProductModifierGroups(activeTenantId),
    getCachedCoupons(activeTenantId),
  ]);

  const isCpqActive = activeModuleIds.includes("mto_cpq");
  const [cpqMatrices, cpqCostSettings] = isCpqActive
    ? await Promise.all([
        MarketOSRepository.getCpqPricingMatrices(activeTenantId),
        MarketOSRepository.getTenantCpqSettings(activeTenantId),
      ])
    : [[], null];

  const cpqAttributeOptions =
    isCpqActive && cpqMatrices.length > 0
      ? (
          await Promise.all(
            cpqMatrices.map((m) =>
              MarketOSRepository.getCpqMatrixAttributeOptions(m.id)
            )
          )
        ).flat()
      : [];

  const cpqVolumeTiers =
    isCpqActive && cpqMatrices.length > 0
      ? (
          await Promise.all(
            cpqMatrices.map((m) =>
              MarketOSRepository.getCpqVolumeTiers(m.id)
            )
          )
        ).flat()
      : [];

  return (
    <>
      <AnalyticsTracker tenantId={activeTenantId} />
      <StorefrontPage
        settings={settings}
        categories={categories}
        products={products}
        stores={stores}
        deliveryZones={deliveryZones}
        exchangeRate={exchangeRate}
        activeModuleIds={activeModuleIds}
        modifierGroups={modifierGroups}
        coupons={coupons}
        cpqMatrices={cpqMatrices}
        cpqCostSettings={cpqCostSettings}
        cpqAttributeOptions={cpqAttributeOptions}
        cpqVolumeTiers={cpqVolumeTiers}
      />
    </>
  );
}
