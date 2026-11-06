import React from "react";
import { resolveAuthorizedAdminContext } from "../admin-context";
import { getCashRegisters } from "../pos-actions";
import { POSDashboardView } from "@/components/pos/pos-dashboard-view";

export const dynamic = "force-dynamic";

export default async function AdminPOSPage({
  searchParams,
}: {
  searchParams?: Promise<{ tenant?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const context = await resolveAuthorizedAdminContext(params);

  const tenantId = context.targetTenantId;
  const storeId = context.stores[0]?.id || "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d";

  let registers: any[] = [];
  try {
    registers = await getCashRegisters(tenantId, storeId);
  } catch (err) {
    console.error("[MarketOS POS] Error loading cash registers:", err);
    registers = [];
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <POSDashboardView
          initialRegisters={registers}
          tenantId={tenantId}
          storeId={storeId}
          currentUser={context.currentUser}
        />
      </div>
    </div>
  );
}
