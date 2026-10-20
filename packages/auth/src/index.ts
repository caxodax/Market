import { UserRole } from "@marketos/types";

/**
 * Validates if a user role has permission to access a tenant resource
 */
export function hasTenantPermission(
  userRole: UserRole,
  userTenantId: string | null,
  targetTenantId: string,
  allowedRoles: UserRole[] = ["TENANT_OWNER", "TENANT_MANAGER"]
): boolean {
  // Super admin can manage any tenant
  if (userRole === "PLATFORM_SUPER_ADMIN") {
    return true;
  }

  // Cross-tenant access is strictly prohibited
  if (!userTenantId || userTenantId !== targetTenantId) {
    return false;
  }

  return allowedRoles.includes(userRole);
}

/**
 * Checks if user is an employee of a specific tenant
 */
export function isTenantEmployee(role: UserRole): boolean {
  return [
    "TENANT_OWNER",
    "TENANT_MANAGER",
    "TENANT_INVENTORY",
    "TENANT_CASHIER",
    "TENANT_DELIVERY",
  ].includes(role);
}

export * from "./session";

