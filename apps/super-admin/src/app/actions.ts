"use server";

import { MarketOSRepository } from "@marketos/database";
import { OnboardTenantInput, TenantModuleId } from "@marketos/types";
import { revalidatePath } from "next/cache";
import { getCurrentSuperAdminUser } from "./login/actions";

/**
 * Security Boundary: Validates caller has super_admin role
 */
async function assertSuperAdmin() {
  const user = await getCurrentSuperAdminUser();
  if (!user || user.role !== "PLATFORM_SUPER_ADMIN") {
    throw new Error("No autorizado. Se requieren permisos de Super Administrador de Plataforma.");
  }
  return user;
}

/**
 * Onboard and automatically provision a new tenant
 */
export async function onboardTenantAction(input: OnboardTenantInput) {
  try {
    await assertSuperAdmin();
    const tenant = await MarketOSRepository.onboardTenant(input);
    revalidatePath("/");
    return { success: true, tenant };
  } catch (error) {
    console.error("Error onboarding tenant:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al registrar e incorporar el nuevo comercio",
    };
  }
}

/**
 * Update tenant status (Active, Suspended, Trial)
 */
export async function updateTenantStatusAction(
  tenantId: string,
  status: "active" | "inactive" | "suspended" | "trial"
) {
  try {
    await assertSuperAdmin();
    const updated = await MarketOSRepository.updateTenantStatus(tenantId, status);
    revalidatePath("/");
    return { success: updated };
  } catch (error) {
    console.error("Error updating tenant status:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al actualizar estado del comercio",
    };
  }
}

/**
 * Get installed and available modules for a tenant
 */
export async function getTenantModulesAction(tenantId: string) {
  try {
    await assertSuperAdmin();
    const modules = await MarketOSRepository.getTenantModules(tenantId);
    return { success: true, modules };
  } catch (error) {
    console.error("Error fetching tenant modules:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al consultar los módulos del comercio",
    };
  }
}

/**
 * Enable or disable a plugin/module for a specific tenant
 */
export async function setTenantModuleStatusAction(
  tenantId: string,
  moduleId: TenantModuleId,
  isEnabled: boolean
) {
  try {
    await assertSuperAdmin();
    const success = await MarketOSRepository.setTenantModuleStatus(tenantId, moduleId, isEnabled);
    revalidatePath("/");
    return { success };
  } catch (error) {
    console.error("Error setting tenant module status:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al actualizar el estado del módulo",
    };
  }
}
