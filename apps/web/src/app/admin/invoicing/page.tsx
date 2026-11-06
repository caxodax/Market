import React from "react";
import { resolveAuthorizedAdminContext, assertTenantModuleActive } from "../admin-context";
import { MarketOSRepository, InvoicingRepository } from "@marketos/database";
import { InvoicingView } from "@/components/invoicing-view";

export const dynamic = "force-dynamic";

export default async function AdminInvoicingPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const params = await searchParams;
  const context = await resolveAuthorizedAdminContext(params);

  await assertTenantModuleActive(context.targetTenantId, "invoicing");

  const [fiscalDocuments, orders, drivers] = await Promise.all([
    InvoicingRepository.getFiscalDocuments(context.targetTenantId),
    MarketOSRepository.getTenantOrders(context.targetTenantId, 100),
    context.activeModuleIds.includes("delivery_fleet")
      ? MarketOSRepository.getDrivers(context.targetTenantId, true)
      : Promise.resolve([]),
  ]);

  return (
    <InvoicingView
      settings={context.settings}
      activeModuleIds={context.activeModuleIds}
      initialDocuments={fiscalDocuments}
      orders={orders}
      drivers={drivers}
    />
  );
}
