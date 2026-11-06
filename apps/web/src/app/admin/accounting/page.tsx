import React from "react";
import { resolveAuthorizedAdminContext, assertTenantModuleActive } from "../admin-context";
import { InvoicingRepository, PurchasingRepository } from "@marketos/database";
import { AccountingManagerAdmin } from "@marketos/plugin-accounting";

export const dynamic = "force-dynamic";

export default async function AdminAccountingPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const params = await searchParams;
  const context = await resolveAuthorizedAdminContext(params);

  await assertTenantModuleActive(context.targetTenantId, "accounting");

  const [fiscalDocuments, purchaseInvoices] = await Promise.all([
    InvoicingRepository.getFiscalDocuments(context.targetTenantId),
    PurchasingRepository.getPurchaseInvoices(context.targetTenantId),
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      <AccountingManagerAdmin
        tenantId={context.targetTenantId}
        settings={context.settings}
        activeModuleIds={context.activeModuleIds}
        initialInvoices={fiscalDocuments}
        initialPurchaseInvoices={purchaseInvoices}
      />
    </div>
  );
}
