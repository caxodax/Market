import React from "react";
import { resolveAuthorizedAdminContext } from "../admin-context";
import { MarketOSRepository } from "@marketos/database";
import { SalesReportsTab } from "@/components/sales-reports-tab";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const params = await searchParams;
  const context = await resolveAuthorizedAdminContext(params);

  const [orders, payments] = await Promise.all([
    MarketOSRepository.getTenantOrders(context.targetTenantId, 100),
    MarketOSRepository.getTenantPayments(context.targetTenantId),
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      <SalesReportsTab
        tenantId={context.targetTenantId}
        settings={context.settings}
        exchangeRate={context.exchangeRate}
        initialOrders={orders}
        initialPayments={payments}
        activeModuleIds={context.activeModuleIds}
      />
    </div>
  );
}
