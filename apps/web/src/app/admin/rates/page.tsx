import React from "react";
import { resolveAuthorizedAdminContext, assertTenantModuleActive } from "../admin-context";
import { MarketOSRepository } from "@marketos/database";
import { ExchangeRateManager } from "@/components/exchange-rate-manager";

export const dynamic = "force-dynamic";

export default async function AdminRatesPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const params = await searchParams;
  const context = await resolveAuthorizedAdminContext(params);

  await assertTenantModuleActive(context.targetTenantId, "local_venezuela");

  const ratesHistory = await MarketOSRepository.getExchangeRateHistory(
    context.targetTenantId,
    40
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      <ExchangeRateManager
        tenantId={context.targetTenantId}
        initialRate={context.exchangeRate}
        initialHistory={ratesHistory}
        isSuperAdmin={context.isSuperAdmin}
      />
    </div>
  );
}
