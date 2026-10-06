import React from "react";
import { MarketOSRepository } from "@marketos/database";
import { SuperAdminDashboard } from "../components/super-admin-dashboard";

export const dynamic = "force-dynamic";

export default async function SuperAdminHomePage() {
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
    />
  );
}
