import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../login/actions";
import { getCashRegisters } from "../pos-actions";
import { POSDashboardView } from "@/components/pos/pos-dashboard-view";

export const dynamic = "force-dynamic";

export default async function AdminPOSPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const allowedRoles = [
    "PLATFORM_SUPER_ADMIN",
    "TENANT_OWNER",
    "TENANT_MANAGER",
    "TENANT_CASHIER",
  ];

  if (!allowedRoles.includes(currentUser.role)) {
    redirect("/admin");
  }

  const tenantId = currentUser.tenant_id || "shop-market-ca";
  // ID por defecto de la tienda principal
  const storeId = "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d";

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
          currentUser={currentUser}
        />
      </div>
    </div>
  );
}
