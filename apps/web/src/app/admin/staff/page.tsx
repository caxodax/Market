import React from "react";
import { resolveAuthorizedAdminContext } from "../admin-context";
import { MarketOSRepository } from "@marketos/database";
import { StaffView } from "@/components/staff-view";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const params = await searchParams;
  const context = await resolveAuthorizedAdminContext(params);

  const staff = await MarketOSRepository.getTenantStaff(context.targetTenantId);

  return (
    <StaffView
      initialStaff={staff}
      settings={context.settings}
      currentUser={context.currentUser}
    />
  );
}
