import { notFound } from "next/navigation";
import type { Metadata, Viewport } from "next";
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
  getCachedProductModifierGroups,
  getCachedCpqPricingMatrices,
  getCachedCpqCostSettings,
} from "../../../lib/cached-queries";
import { MarketOSRepository } from "@marketos/database";
import { StorefrontPage } from "../../../components/storefront-page";
import { SuspendedStorePage } from "../../../components/suspended-store-page";
import { AnalyticsTracker } from "@marketos/plugin-analytics";

export const dynamic = "force-dynamic";

interface TenantPageProps {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export async function generateViewport({
  params,
}: TenantPageProps): Promise<Viewport> {
  const { tenant: rawTenant } = await params;
  const tenantSlugOrId = decodeURIComponent(rawTenant).trim().toLowerCase();

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
  params,
}: TenantPageProps): Promise<Metadata> {
  const { tenant: rawTenant } = await params;
  const tenantSlugOrId = decodeURIComponent(rawTenant).trim().toLowerCase();

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

export default async function TenantPage({ params }: TenantPageProps) {
  const { tenant: rawTenant } = await params;
  const tenantSlugOrId = decodeURIComponent(rawTenant).trim().toLowerCase();

  let tenant = await getCachedTenant(tenantSlugOrId);
  if (!tenant) {
    tenant = await MarketOSRepository.getTenant(tenantSlugOrId);
  }
  if (!tenant) {
    notFound();
  }

  const activeTenantId = tenant.id;

  if (tenant.status === "suspended" || tenant.status === "inactive") {
    const settings = await getCachedTenantSettings(activeTenantId);
    return <SuspendedStorePage settings={settings} tenant={tenant} />;
  }

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
    getCachedProductModifierGroups(activeTenantId),
    getCachedCoupons(activeTenantId),
  ]);

  const isCpqActive = activeModuleIds.includes("mto_cpq");
  const [cpqMatrices, cpqCostSettings] = isCpqActive
    ? await Promise.all([
        getCachedCpqPricingMatrices(activeTenantId),
        getCachedCpqCostSettings(activeTenantId),
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
