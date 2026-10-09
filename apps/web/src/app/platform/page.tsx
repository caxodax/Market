import React from "react";
import { redirect } from "next/navigation";
import { MarketOSRepository } from "@marketos/database";
import { SuperAdminDashboard } from "../../components/super-admin-dashboard";
import { getCurrentUser } from "../login/actions";

export const dynamic = "force-dynamic";

export default async function PlatformSuperAdminPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  // Strict check: only PLATFORM_SUPER_ADMIN can enter platform console
  if (currentUser.role !== "PLATFORM_SUPER_ADMIN") {
    redirect("/admin");
  }

  const [metrics, tenants, plans, exchangeRate, ratesHistory] = await Promise.all([
    MarketOSRepository.getPlatformMetrics(),
    MarketOSRepository.getAllTenants(),
    MarketOSRepository.getSubscriptionPlans(),
    MarketOSRepository.getExchangeRate("shop-market-ca"),
    MarketOSRepository.getExchangeRateHistory(undefined, 50),
  ]);

  return (
    <SuperAdminDashboard
      metrics={metrics}
      tenants={tenants}
      plans={plans}
      currentUser={currentUser}
      exchangeRate={exchangeRate}
      ratesHistory={ratesHistory}
    />
  );
}
