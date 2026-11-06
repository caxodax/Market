import React from "react";
import { resolveAuthorizedAdminContext, assertTenantModuleActive } from "../admin-context";
import { MarketOSRepository } from "@marketos/database";
import { CouponManager } from "@/components/coupon-manager";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const params = await searchParams;
  const context = await resolveAuthorizedAdminContext(params);

  await assertTenantModuleActive(context.targetTenantId, "promotions_coupons");

  const coupons = await MarketOSRepository.getCoupons(context.targetTenantId);

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      <CouponManager
        tenantId={context.targetTenantId}
        initialCoupons={coupons}
      />
    </div>
  );
}
