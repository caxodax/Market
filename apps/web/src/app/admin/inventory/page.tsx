import React from "react";
import { resolveAuthorizedAdminContext } from "../admin-context";
import { MarketOSRepository } from "@marketos/database";
import { InventoryView } from "@/components/inventory-view";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const params = await searchParams;
  const context = await resolveAuthorizedAdminContext(params);

  const [products, categories] = await Promise.all([
    MarketOSRepository.getProducts(context.targetTenantId, undefined, undefined, 100),
    MarketOSRepository.getCategories(context.targetTenantId),
  ]);

  return (
    <InventoryView
      initialProducts={products}
      initialCategories={categories}
      rate={context.exchangeRate}
      settings={context.settings}
      planLimits={context.planLimits}
      activeModuleIds={context.activeModuleIds}
    />
  );
}
