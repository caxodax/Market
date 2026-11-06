import React from "react";
import { resolveAuthorizedAdminContext, assertTenantModuleActive } from "../admin-context";
import { PurchasingRepository } from "@marketos/database";
import { PurchasingView } from "@/components/purchasing-view";

export const dynamic = "force-dynamic";

export default async function AdminPurchasingPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const params = await searchParams;
  const context = await resolveAuthorizedAdminContext(params);

  await assertTenantModuleActive(context.targetTenantId, "purchasing_retentions");

  const [invoices, vouchers, suppliers] = await Promise.all([
    PurchasingRepository.getPurchaseInvoices(context.targetTenantId),
    PurchasingRepository.getRetentionVouchers(context.targetTenantId),
    PurchasingRepository.getSuppliers(context.targetTenantId),
  ]);

  return (
    <PurchasingView
      settings={context.settings}
      activeModuleIds={context.activeModuleIds}
      initialInvoices={invoices}
      initialVouchers={vouchers}
      initialSuppliers={suppliers}
      defaultExchangeRate={context.exchangeRate.value}
    />
  );
}
