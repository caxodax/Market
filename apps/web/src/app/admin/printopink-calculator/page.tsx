import React from "react";
import { resolveAuthorizedAdminContext, assertTenantModuleActive } from "../admin-context";
import { PrintopinkCalculatorAdmin } from "@/components/printopink-calculator-admin";

export const dynamic = "force-dynamic";

export default async function AdminPrintopinkCalculatorPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const params = await searchParams;
  const context = await resolveAuthorizedAdminContext(params);

  await assertTenantModuleActive(context.targetTenantId, "printopink_calculator");

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      <PrintopinkCalculatorAdmin
        tenantId={context.targetTenantId}
        exchangeRate={context.exchangeRate.value}
        currencySymbol="$"
        businessName={context.settings.business_name}
      />
    </div>
  );
}
