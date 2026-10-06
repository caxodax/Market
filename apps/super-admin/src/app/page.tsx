import React from "react";
import { redirect } from "next/navigation";
import { MarketOSRepository } from "@marketos/database";
import { SuperAdminDashboard } from "../components/super-admin-dashboard";
import { getCurrentSuperAdminUser } from "./login/actions";

export const dynamic = "force-dynamic";

export default async function SuperAdminHomePage() {
  const currentUser = await getCurrentSuperAdminUser();

  if (!currentUser) {
    redirect("/login");
  }

  const [metrics, tenants, plans] = await Promise.all([
    MarketOSRepository.getPlatformMetrics(),
    MarketOSRepository.getAllTenants(),
    MarketOSRepository.getSubscriptionPlans(),
  ]);

  return (
    <SuperAdminDashboard
      metrics={metrics}
      tenants={tenants}
      plans={plans}
      currentUser={currentUser}
    />
  );
}

