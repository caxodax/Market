import React from "react";
import { resolveAuthorizedAdminContext, assertTenantModuleActive } from "../admin-context";
import { CraftWorkshopAdmin } from "@/components/craft-workshop-admin";

export const dynamic = "force-dynamic";

export default async function AdminCraftPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const params = await searchParams;
  const context = await resolveAuthorizedAdminContext(params);

  await assertTenantModuleActive(context.targetTenantId, "craft_workshop");

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      <CraftWorkshopAdmin
        tenantId={context.targetTenantId}
        exchangeRate={context.exchangeRate.value}
        currencySymbol="$"
        businessName={context.settings.business_name}
        businessPhone={context.settings.whatsapp_number || context.settings.phone}
      />
    </div>
  );
}
