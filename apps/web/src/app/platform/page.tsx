import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MarketOSRepository } from "@marketos/database";
import { formatMediaUrl } from "@marketos/utils";
import { SuperAdminDashboard } from "../../components/super-admin-dashboard";
import { getCurrentUser } from "../login/actions";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await MarketOSRepository.getPlatformSettings();
  const name = settings.platform_name || "MarketOS";
  const logo = settings.logo_url ? formatMediaUrl(settings.logo_url) : "/icon.svg";

  return {
    title: `${name} Master | Consola Centralizada`,
    description: settings.platform_tagline || "Consola Centralizada Multi-Tenant SaaS",
    icons: {
      icon: [{ url: logo }],
      shortcut: [{ url: logo }],
      apple: [{ url: logo }],
    },
  };
}

export default async function PlatformSuperAdminPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  // Strict check: only PLATFORM_SUPER_ADMIN can enter platform console
  if (currentUser.role !== "PLATFORM_SUPER_ADMIN") {
    redirect("/admin");
  }

  const [
    metrics,
    tenants,
    plans,
    exchangeRate,
    ratesHistory,
    profiles,
    auditLogs,
    biAnalytics,
    storageTelemetry,
    platformSettings,
  ] = await Promise.all([
    MarketOSRepository.getPlatformMetrics(),
    MarketOSRepository.getAllTenants(),
    MarketOSRepository.getSubscriptionPlans(),
    MarketOSRepository.getExchangeRate("shop-market-ca"),
    MarketOSRepository.getExchangeRateHistory(undefined, 50),
    MarketOSRepository.getAllProfiles(),
    MarketOSRepository.getGlobalAuditLogs({ limit: 150 }),
    MarketOSRepository.getPlatformBiAnalytics("all"),
    MarketOSRepository.getPlatformStorageTelemetry(),
    MarketOSRepository.getPlatformSettings(),
  ]);

  return (
    <SuperAdminDashboard
      metrics={metrics}
      tenants={tenants}
      plans={plans}
      currentUser={currentUser}
      exchangeRate={exchangeRate}
      ratesHistory={ratesHistory}
      initialProfiles={profiles}
      initialAuditLogs={auditLogs}
      initialBiAnalytics={biAnalytics}
      initialStorageTelemetry={storageTelemetry}
      initialPlatformSettings={platformSettings}
    />
  );
}
