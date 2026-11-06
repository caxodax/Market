import React from "react";
import { resolveAuthorizedAdminContext } from "../admin-context";
import { MarketOSRepository } from "@marketos/database";
import { AuditTrailViewer } from "@/components/audit-trail-viewer";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const params = await searchParams;
  const context = await resolveAuthorizedAdminContext(params);

  const [logs, allTenants] = await Promise.all([
    MarketOSRepository.getAuditLogs(context.targetTenantId),
    context.isSuperAdmin ? MarketOSRepository.getAllTenants() : Promise.resolve([]),
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      <AuditTrailViewer
        initialLogs={logs}
        tenantId={context.targetTenantId}
        isSuperAdmin={context.isSuperAdmin}
        allTenants={allTenants}
      />
    </div>
  );
}
