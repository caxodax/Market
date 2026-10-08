"use server";

import { MarketOSRepository } from "@marketos/database";
import { OnboardTenantInput } from "@marketos/types";
import { revalidatePath } from "next/cache";

/**
 * Onboard and automatically provision a new tenant
 */
export async function onboardTenantAction(input: OnboardTenantInput) {
  try {
    const tenant = await MarketOSRepository.onboardTenant(input);
    revalidatePath("/platform");
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
    const updated = await MarketOSRepository.updateTenantStatus(tenantId, status);
    revalidatePath("/platform");
    return { success: updated };
  } catch (error) {
    console.error("Error updating tenant status:", error);
    return { success: false, error: "Error al actualizar estado del comercio" };
  }
}
