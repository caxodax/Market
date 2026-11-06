import React from "react";
import { resolveAuthorizedAdminContext, assertTenantModuleActive } from "../admin-context";
import { MarketOSRepository } from "@marketos/database";
import { StorefrontStudioView } from "@/components/storefront-studio-view";

export const dynamic = "force-dynamic";

export default async function AdminStorefrontStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const params = await searchParams;
  const context = await resolveAuthorizedAdminContext(params);

  await assertTenantModuleActive(context.targetTenantId, "storefront_pro");

  const [categories, products] = await Promise.all([
    MarketOSRepository.getCategories(context.targetTenantId),
    MarketOSRepository.getProducts(context.targetTenantId, undefined, undefined, 100),
  ]);

  return (
    <StorefrontStudioView
      settings={context.settings}
      categories={categories}
      products={products}
      stores={context.stores}
      exchangeRate={context.exchangeRate}
    />
  );
}
