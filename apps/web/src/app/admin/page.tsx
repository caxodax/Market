import React from "react";
import { redirect } from "next/navigation";
import { MarketOSRepository } from "@marketos/database";
import { AdminDashboard } from "../../components/admin-dashboard";
import { getCurrentUser } from "../login/actions";

const TENANT_ID = process.env.DEFAULT_TENANT_ID || "shop-market-ca";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
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
  ] = await Promise.all([
    MarketOSRepository.getTenantSettings(TENANT_ID),
    MarketOSRepository.getProducts(TENANT_ID),
    MarketOSRepository.getCategories(TENANT_ID),
    MarketOSRepository.getTenantOrders(TENANT_ID),
    MarketOSRepository.getTenantPayments(TENANT_ID),
    MarketOSRepository.getExchangeRate(TENANT_ID),
    MarketOSRepository.getDeliveryZones(TENANT_ID),
    MarketOSRepository.getDrivers(TENANT_ID),
    MarketOSRepository.getAuditLogs(TENANT_ID),
    MarketOSRepository.getTenantStaff(TENANT_ID),
    MarketOSRepository.getExchangeRateHistory(TENANT_ID, 40),
    MarketOSRepository.getCoupons(TENANT_ID),
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
    />
  );
}
