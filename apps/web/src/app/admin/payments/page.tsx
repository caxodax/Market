import React from "react";
import { resolveAuthorizedAdminContext } from "../admin-context";
import { MarketOSRepository } from "@marketos/database";
import { PaymentsView } from "@/components/payments-view";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const params = await searchParams;
  const context = await resolveAuthorizedAdminContext(params);

  const [payments, orders] = await Promise.all([
    MarketOSRepository.getTenantPayments(context.targetTenantId),
    MarketOSRepository.getTenantOrders(context.targetTenantId, 100),
  ]);

  return (
    <PaymentsView
      initialPayments={payments}
      initialOrders={orders}
      settings={context.settings}
      activeModuleIds={context.activeModuleIds}
    />
  );
}
