import React from "react";
import { resolveAuthorizedAdminContext } from "../admin-context";
import { MarketOSRepository } from "@marketos/database";
import { OrdersView } from "@/components/orders-view";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const params = await searchParams;
  const context = await resolveAuthorizedAdminContext(params);

  const [orders, drivers] = await Promise.all([
    MarketOSRepository.getTenantOrders(context.targetTenantId, 100),
    context.activeModuleIds.includes("delivery_fleet")
      ? MarketOSRepository.getDrivers(context.targetTenantId, true)
      : Promise.resolve([]),
  ]);

  return (
    <OrdersView
      initialOrders={orders}
      initialDrivers={drivers}
      settings={context.settings}
      stores={context.stores}
      activeModuleIds={context.activeModuleIds}
    />
  );
}
