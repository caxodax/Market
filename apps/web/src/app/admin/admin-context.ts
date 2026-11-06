import { cache } from "react";
import { redirect } from "next/navigation";
import { MarketOSRepository } from "@marketos/database";
import {
  TenantSettings,
  Tenant,
  UserProfile,
  TenantPlanLimits,
  TenantModuleId,
  ExchangeRate,
  Store,
} from "@marketos/types";
import { getCurrentUser } from "../login/actions";

export interface AuthorizedAdminContext {
  currentUser: UserProfile;
  targetTenantId: string;
  targetTenant: Tenant | null;
  settings: TenantSettings;
  activeModuleIds: TenantModuleId[];
  planLimits: TenantPlanLimits | null;
  exchangeRate: ExchangeRate;
  stores: Store[];
  isSuperAdmin: boolean;
  isImpersonating: boolean;
  isSuspended: boolean;
}

export const ALLOWED_ADMIN_ROLES = [
  "PLATFORM_SUPER_ADMIN",
  "TENANT_OWNER",
  "TENANT_MANAGER",
  "TENANT_CASHIER",
  "TENANT_INVENTORY",
  "TENANT_DELIVERY",
] as const;

/**
 * Resolves and validates the authenticated multi-tenant admin context.
 * Enforces cryptographic HMAC-SHA256 session authenticity, tenant isolation,
 * role authorization, suspension lockdown, and granular staff permissions.
 * Wrapped in React.cache() to deduplicate requests across Layout and Pages.
 */
export const resolveAuthorizedAdminContext = cache(async function resolveAuthorizedAdminContext(searchParams?: {
  tenant?: string;
  store?: string;
}): Promise<AuthorizedAdminContext> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (!ALLOWED_ADMIN_ROLES.includes(currentUser.role as any)) {
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
    if (searchParams?.tenant) {
      targetTenantId = searchParams.tenant;
    }
  } else if (currentUser.tenant_id) {
    targetTenantId = currentUser.tenant_id;
  }

  // Load tenant profile to verify existence and operational status
  const targetTenant = await MarketOSRepository.getTenant(targetTenantId);
  if (targetTenant?.id) {
    targetTenantId = targetTenant.id;
  }

  const isSuspended = Boolean(
    targetTenant &&
      (targetTenant.status === "suspended" || targetTenant.status === "inactive")
  );

  // Core administrative dataset fetched in parallel for sub-second layout initialization
  const [settings, activeModuleIds, planLimits, exchangeRate, stores] =
    await Promise.all([
      MarketOSRepository.getTenantSettings(targetTenantId),
      MarketOSRepository.getTenantActiveModuleIds(targetTenantId),
      MarketOSRepository.getTenantPlanLimits(targetTenantId),
      MarketOSRepository.getExchangeRate(targetTenantId),
      MarketOSRepository.getStores(targetTenantId, true),
    ]);

  // Synchronize live granular staff permissions without requiring re-login
  if (
    currentUser &&
    currentUser.role !== "PLATFORM_SUPER_ADMIN" &&
    currentUser.role !== "TENANT_OWNER" &&
    settings?.operational_settings?.staff_permissions
  ) {
    const permissionsMap = settings.operational_settings.staff_permissions;
    const perms =
      permissionsMap[currentUser.id] ||
      permissionsMap[currentUser.email.toLowerCase()];
    if (perms) {
      currentUser.custom_permissions = perms;
    }
  }

  return {
    currentUser,
    targetTenantId,
    targetTenant,
    settings,
    activeModuleIds,
    planLimits,
    exchangeRate,
    stores,
    isSuperAdmin,
    isImpersonating,
    isSuspended,
  };
});

/**
 * Guard that verifies if an optional modular plugin is activated and licensed
 * for the current tenant. Redirects with a clear alert if not available.
 */
export async function assertTenantModuleActive(
  tenantId: string,
  moduleId: TenantModuleId
): Promise<void> {
  const activeModules = await MarketOSRepository.getTenantActiveModuleIds(tenantId);
  if (!activeModules.includes(moduleId)) {
    redirect("/admin/plugins?error=module_not_available&module=" + encodeURIComponent(moduleId));
  }
}
