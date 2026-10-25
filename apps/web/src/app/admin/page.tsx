import React from "react";
import { redirect } from "next/navigation";
import { MarketOSRepository, InvoicingRepository } from "@marketos/database";
import { AdminDashboard } from "../../components/admin-dashboard";
import { SuspendedAdminScreen } from "../../components/suspended-admin-screen";
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
    planLimits,
    storageTelemetry,
    activeModuleIds,
    rawMaterials,
    existingRecipes,
    fiscalDocuments,
  ] = await Promise.all([
    MarketOSRepository.getTenantSettings(targetTenantId),
    MarketOSRepository.getProducts(targetTenantId),
    MarketOSRepository.getCategories(targetTenantId),
    MarketOSRepository.getTenantOrders(targetTenantId),
    MarketOSRepository.getTenantPayments(targetTenantId),
    MarketOSRepository.getExchangeRate(targetTenantId),
    MarketOSRepository.getDeliveryZones(targetTenantId, true),
    MarketOSRepository.getDrivers(targetTenantId, true),
    MarketOSRepository.getAuditLogs(targetTenantId),
    MarketOSRepository.getTenantStaff(targetTenantId),
    MarketOSRepository.getExchangeRateHistory(targetTenantId, 40),
    MarketOSRepository.getCoupons(targetTenantId),
    MarketOSRepository.getStores(targetTenantId, true),
    isSuperAdmin ? MarketOSRepository.getAllTenants() : Promise.resolve([]),
    MarketOSRepository.getTenantPlanLimits(targetTenantId),
    MarketOSRepository.getTenantStorageTelemetry(targetTenantId),
    MarketOSRepository.getTenantActiveModuleIds(targetTenantId),
    MarketOSRepository.getRawMaterials(targetTenantId),
    MarketOSRepository.getProductRecipes(targetTenantId),
    InvoicingRepository.getFiscalDocuments(targetTenantId),
  ]);

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
      />
    </div>
  );
}
