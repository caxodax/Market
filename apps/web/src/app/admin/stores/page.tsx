import React from "react";
import { resolveAuthorizedAdminContext } from "../admin-context";
import { MarketOSRepository } from "@marketos/database";
import { StoresView } from "@/components/stores-view";

export const dynamic = "force-dynamic";

export default async function AdminStoresPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const params = await searchParams;
  const context = await resolveAuthorizedAdminContext(params);

  const [stores, orders] = await Promise.all([
    MarketOSRepository.getStores(context.targetTenantId, true),
    MarketOSRepository.getTenantOrders(context.targetTenantId, 100),
  ]);

  return (
    <StoresView
      initialStores={stores}
      initialOrders={orders}
      settings={context.settings}
      planLimits={context.planLimits}
    />
  );
}
