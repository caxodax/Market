import React from "react";
import { redirect } from "next/navigation";
import { MarketOSRepository } from "@marketos/database";
import { AdminDashboard } from "../../components/admin-dashboard";
import { getCurrentUser } from "../login/actions";

interface AdminPageProps {
  searchParams: Promise<{ tenant?: string; store?: string }>;
}

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  // Verify role authorization
  const allowedRoles = [
    "PLATFORM_SUPER_ADMIN",
    "TENANT_OWNER",
    "TENANT_MANAGER",
    "TENANT_CASHIER",
    "TENANT_INVENTORY",
    "TENANT_DELIVERY",
  ];

  if (!allowedRoles.includes(currentUser.role)) {
    redirect("/login");
  }

  const isSuperAdmin = currentUser.role === "PLATFORM_SUPER_ADMIN";

  // Dynamic tenant selection:
  // If PLATFORM_SUPER_ADMIN, allow inspecting any tenant passed via query string (?tenant=...)
  // Otherwise, use currentUser.tenant_id or default tenant
  let targetTenantId = process.env.DEFAULT_TENANT_ID || "shop-market-ca";
  if (isSuperAdmin) {
    if (params?.tenant) {
      targetTenantId = params.tenant;
    }
  } else if (currentUser.tenant_id) {
    targetTenantId = currentUser.tenant_id;
  }

  const [
    settings,
    products,
    categories,
    orders,
    payments,
    exchangeRate,
    deliveryZones,
    drivers,
    auditLogs,
    staffMembers,
    ratesHistory,
    coupons,
    stores,
    allTenants,
  ] = await Promise.all([
    MarketOSRepository.getTenantSettings(targetTenantId),
    MarketOSRepository.getProducts(targetTenantId),
    MarketOSRepository.getCategories(targetTenantId),
    MarketOSRepository.getTenantOrders(targetTenantId),
    MarketOSRepository.getTenantPayments(targetTenantId),
    MarketOSRepository.getExchangeRate(targetTenantId),
    MarketOSRepository.getDeliveryZones(targetTenantId),
    MarketOSRepository.getDrivers(targetTenantId),
    MarketOSRepository.getAuditLogs(targetTenantId),
    MarketOSRepository.getTenantStaff(targetTenantId),
    MarketOSRepository.getExchangeRateHistory(targetTenantId, 40),
    MarketOSRepository.getCoupons(targetTenantId),
    MarketOSRepository.getStores(targetTenantId, true),
    isSuperAdmin ? MarketOSRepository.getAllTenants() : Promise.resolve([]),
  ]);

  return (
    <AdminDashboard
      settings={settings}
      products={products}
      categories={categories}
      orders={orders}
      payments={payments}
      exchangeRate={exchangeRate}
      ratesHistory={ratesHistory}
      deliveryZones={deliveryZones}
      drivers={drivers}
      auditLogs={auditLogs}
      currentUser={currentUser}
      staffMembers={staffMembers}
      coupons={coupons}
      stores={stores}
      allTenants={allTenants}
      currentStoreId={params?.store}
    />
  );
}
