import React from "react";
import { resolveAuthorizedAdminContext } from "../admin-context";
import { PluginsView } from "@/components/plugins-view";

export const dynamic = "force-dynamic";

export default async function AdminPluginsPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const params = await searchParams;
  const context = await resolveAuthorizedAdminContext(params);

  return (
    <PluginsView
      settings={context.settings}
      activeModuleIds={context.activeModuleIds}
      currentUser={context.currentUser}
    />
  );
}
