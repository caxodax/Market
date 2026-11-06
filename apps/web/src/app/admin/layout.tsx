import React from "react";
import { resolveAuthorizedAdminContext } from "./admin-context";
import { SuspendedAdminScreen } from "@/components/suspended-admin-screen";
import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { MarketOSRepository } from "@marketos/database";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await resolveAuthorizedAdminContext();

  // Bloqueo inmediato para comercios suspendidos si el usuario no es super admin ni impersona
  if (context.isSuspended && !context.isSuperAdmin && !context.isImpersonating && context.targetTenant) {
    return (
      <SuspendedAdminScreen
        tenant={context.targetTenant}
        settings={context.settings}
        currentUser={context.currentUser}
      />
    );
  }

  // Pre-cargar conteos operacionales para los badges del sidebar
  const [payments, orders, products] = await Promise.all([
    MarketOSRepository.getTenantPayments(context.targetTenantId),
    MarketOSRepository.getTenantOrders(context.targetTenantId, 100),
    MarketOSRepository.getProducts(context.targetTenantId, undefined, undefined, 100),
  ]);

  const pendingPaymentsCount = payments.filter((p) => p.status === "PENDING").length;

  return (
    <AdminLayoutShell
      currentUser={context.currentUser}
      targetTenantId={context.targetTenantId}
      targetTenant={context.targetTenant}
      settings={context.settings}
      activeModuleIds={context.activeModuleIds}
      planLimits={context.planLimits}
      exchangeRate={context.exchangeRate}
      stores={context.stores}
      isSuperAdmin={context.isSuperAdmin}
      isImpersonating={context.isImpersonating}
      isSuspended={context.isSuspended}
      pendingPaymentsCount={pendingPaymentsCount}
      ordersCount={orders.length}
      productsCount={products.length}
    >
      {children}
    </AdminLayoutShell>
  );
}
