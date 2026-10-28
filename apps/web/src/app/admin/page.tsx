import React from "react";
import { redirect } from "next/navigation";
import {
  MarketOSRepository,
  InvoicingRepository,
  PurchasingRepository,
} from "@marketos/database";
import { AdminDashboard } from "../../components/admin-dashboard";
import { SuspendedAdminScreen } from "../../components/suspended-admin-screen";
import { getCurrentUser } from "../login/actions";

interface AdminPageProps {
  searchParams: Promise<{ tenant?: string; store?: string; tab?: string }>;
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
  const isImpersonating = Boolean(currentUser.impersonation);

  // Dynamic tenant selection:
  // 1. If in support impersonation mode, target the impersonated tenant
  // 2. If PLATFORM_SUPER_ADMIN, allow inspecting any tenant passed via query string (?tenant=...)
  // 3. Otherwise, use currentUser.tenant_id or default tenant
  let targetTenantId = process.env.DEFAULT_TENANT_ID || "shop-market-ca";
  if (currentUser.impersonation) {
    targetTenantId = currentUser.impersonation.targetTenantId;
  } else if (isSuperAdmin) {
    if (params?.tenant) {
      targetTenantId = params.tenant;
    }
  } else if (currentUser.tenant_id) {
    targetTenantId = currentUser.tenant_id;
  }

  // Verificar si la tienda está suspendida y resolver ID auténtico del tenant
  const targetTenant = await MarketOSRepository.getTenant(targetTenantId);
  if (targetTenant?.id) {
    targetTenantId = targetTenant.id;
  }

  // BLOQUEO INMEDIATO: Si la tienda está suspendida y el usuario no es Super Admin ni está en modo soporte
  if (
    targetTenant &&
    (targetTenant.status === "suspended" || targetTenant.status === "inactive") &&
    !isSuperAdmin &&
    !isImpersonating
  ) {
    const settings = await MarketOSRepository.getTenantSettings(targetTenantId);
    return (
      <SuspendedAdminScreen
        tenant={targetTenant}
        settings={settings}
        currentUser={currentUser}
      />
    );
  }

  const activeTab = params?.tab || "PAYMENTS";

  // Ponytail Ultra: Fast-Path Core Queries (Reduced from 23 to 8).
  // Fetches only what is needed to immediately paint the active view without stalling TTFB.
  const [
    settings,
    orders,
    payments,
    exchangeRate,
    stores,
    planLimits,
    activeModuleIds,
    products,
    categories,
  ] = await Promise.all([
    MarketOSRepository.getTenantSettings(targetTenantId),
    MarketOSRepository.getTenantOrders(targetTenantId, 100),
    MarketOSRepository.getTenantPayments(targetTenantId),
    MarketOSRepository.getExchangeRate(targetTenantId),
    MarketOSRepository.getStores(targetTenantId, true),
    MarketOSRepository.getTenantPlanLimits(targetTenantId),
    MarketOSRepository.getTenantActiveModuleIds(targetTenantId),
    MarketOSRepository.getProducts(targetTenantId, undefined, undefined, 100),
    MarketOSRepository.getCategories(targetTenantId),
  ]);

  // Secondary tab data: fetched on server ONLY if explicitly requested by URL ?tab=..., otherwise deferred
  const [
    deliveryZones,
    drivers,
    auditLogs,
    staffMembers,
    ratesHistory,
    coupons,
    rawMaterials,
    existingRecipes,
    fiscalDocuments,
    purchaseInvoices,
    retentionVouchers,
    suppliers,
    allTenants,
  ] = await Promise.all([
    activeTab === "DELIVERY"
      ? MarketOSRepository.getDeliveryZones(targetTenantId, true)
      : Promise.resolve([]),
    activeTab === "DELIVERY"
      ? MarketOSRepository.getDrivers(targetTenantId, true)
      : Promise.resolve([]),
    activeTab === "AUDIT"
      ? MarketOSRepository.getAuditLogs(targetTenantId)
      : Promise.resolve([]),
    activeTab === "STAFF"
      ? MarketOSRepository.getTenantStaff(targetTenantId)
      : Promise.resolve([]),
    activeTab === "RATES"
      ? MarketOSRepository.getExchangeRateHistory(targetTenantId, 40)
      : Promise.resolve([]),
    activeTab === "COUPONS"
      ? MarketOSRepository.getCoupons(targetTenantId)
      : Promise.resolve([]),
    activeTab === "RAW_MATERIALS"
      ? MarketOSRepository.getRawMaterials(targetTenantId)
      : Promise.resolve([]),
    activeTab === "RECIPES"
      ? MarketOSRepository.getProductRecipes(targetTenantId)
      : Promise.resolve([]),
    activeTab === "INVOICING" || activeTab === "ACCOUNTING"
      ? InvoicingRepository.getFiscalDocuments(targetTenantId)
      : Promise.resolve([]),
    activeTab === "PURCHASING" || activeTab === "ACCOUNTING"
      ? PurchasingRepository.getPurchaseInvoices(targetTenantId)
      : Promise.resolve([]),
    activeTab === "PURCHASING"
      ? PurchasingRepository.getRetentionVouchers(targetTenantId)
      : Promise.resolve([]),
    activeTab === "PURCHASING"
      ? PurchasingRepository.getSuppliers(targetTenantId)
      : Promise.resolve([]),
    isSuperAdmin ? MarketOSRepository.getAllTenants() : Promise.resolve([]),
  ]);

  const storageTelemetry = undefined;

  return (
    <div className="relative">
      {targetTenant?.status === "suspended" && isSuperAdmin && (
        <div className="bg-rose-600 text-white text-xs font-bold px-4 py-2.5 flex items-center justify-between sticky top-0 z-50 shadow-md">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>
              COMERCIO SUSPENDIDO: Este comercio ({targetTenant.name}) se encuentra suspendido. Ni clientes ni empleados tienen acceso al sistema.
            </span>
          </div>
          <a
            href="/platform"
            className="px-3 py-1 bg-white text-rose-700 rounded-lg text-xs font-bold hover:bg-neutral-100 transition-colors shadow-xs"
          >
            Gestionar en Master Platform
          </a>
        </div>
      )}
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
        planLimits={planLimits}
        storageTelemetry={storageTelemetry}
        activeModuleIds={activeModuleIds}
        initialRawMaterials={rawMaterials}
        initialRecipes={existingRecipes}
        initialFiscalDocuments={fiscalDocuments}
        initialPurchaseInvoices={purchaseInvoices}
        initialRetentionVouchers={retentionVouchers}
        initialSuppliers={suppliers}
      />
    </div>
  );
}
