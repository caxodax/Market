import React from "react";
import { resolveAuthorizedAdminContext } from "../admin-context";
import { StoreSettingsTab } from "@/components/store-settings-tab";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const params = await searchParams;
  const context = await resolveAuthorizedAdminContext(params);

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      <StoreSettingsTab
        settings={context.settings}
        activeModuleIds={context.activeModuleIds}
        isSuperAdmin={context.isSuperAdmin}
        exchangeRate={context.exchangeRate}
      />
    </div>
  );
}
