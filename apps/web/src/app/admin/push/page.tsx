import React from "react";
import { resolveAuthorizedAdminContext, assertTenantModuleActive } from "../admin-context";
import { PushNotificationsManager } from "@/components/push-notifications-manager";

export const dynamic = "force-dynamic";

export default async function AdminPushPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const params = await searchParams;
  const context = await resolveAuthorizedAdminContext(params);

  await assertTenantModuleActive(context.targetTenantId, "push_notifications");

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      <PushNotificationsManager
        tenantId={context.targetTenantId}
        settings={context.settings}
      />
    </div>
  );
}
