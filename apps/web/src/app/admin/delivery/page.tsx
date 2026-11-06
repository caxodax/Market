import React from "react";
import { resolveAuthorizedAdminContext, assertTenantModuleActive } from "../admin-context";
import { MarketOSRepository } from "@marketos/database";
import { DeliveryManager } from "@/components/delivery-manager";

export const dynamic = "force-dynamic";

export default async function AdminDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const params = await searchParams;
  const context = await resolveAuthorizedAdminContext(params);

  await assertTenantModuleActive(context.targetTenantId, "delivery_fleet");

  const [deliveryZones, drivers, orders] = await Promise.all([
    MarketOSRepository.getDeliveryZones(context.targetTenantId, true),
    MarketOSRepository.getDrivers(context.targetTenantId, true),
    MarketOSRepository.getTenantOrders(context.targetTenantId, 50),
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      <DeliveryManager
        tenantId={context.targetTenantId}
        initialDeliveryZones={deliveryZones}
        initialDrivers={drivers}
        exchangeRate={context.exchangeRate}
        activeModuleIds={context.activeModuleIds}
        orders={orders}
      />
    </div>
  );
}
