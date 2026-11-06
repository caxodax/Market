import React from "react";
import { resolveAuthorizedAdminContext, assertTenantModuleActive } from "../admin-context";
import { MarketOSRepository } from "@marketos/database";
import { MtoCpqAdminPanel } from "@marketos/plugin-mto-cpq";

export const dynamic = "force-dynamic";

export default async function AdminMtoCpqPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const params = await searchParams;
  const context = await resolveAuthorizedAdminContext(params);

  await assertTenantModuleActive(context.targetTenantId, "mto_cpq");

  const orders = await MarketOSRepository.getTenantOrders(context.targetTenantId, 50);

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      <MtoCpqAdminPanel
        tenantId={context.targetTenantId}
        businessName={context.settings.business_name}
        businessPhone={context.settings.whatsapp_number || context.settings.phone}
        orders={orders}
        formatCurrency={(val) => `$${val.toFixed(2)}`}
      />
    </div>
  );
}
