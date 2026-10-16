"use server";

import { MarketOSRepository } from "@marketos/database";
import {
  OnboardTenantInput,
  SubscriptionPlanTier,
  AuditLogFilters,
  PlatformBiAnalyticsFilter,
} from "@marketos/types";
import { revalidatePath } from "next/cache";
import { invalidateTenantCache } from "../../lib/cached-queries";
import { getCurrentUser } from "../login/actions";

/**
 * Onboard and automatically provision a new tenant
 */
export async function onboardTenantAction(input: OnboardTenantInput) {
  try {
    const tenant = await MarketOSRepository.onboardTenant(input);
    const currentUser = await getCurrentUser();
    await MarketOSRepository.recordAuditLog({
      tenantId: tenant.id,
      tenantName: tenant.name,
      actorId: currentUser?.id,
      actorName: currentUser?.full_name,
      actorEmail: currentUser?.email,
      actorRole: currentUser?.role,
      action: "TENANT_ONBOARDED",
      entity: "tenants",
      entityId: tenant.id,
      newData: { name: tenant.name, slug: tenant.slug },
    });
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
 * Update tenant status (Active, Suspended, Trial, Inactive)
 * Invalida inmediatamente el Edge Data Cache de Next.js y revalida todas las rutas
 * para que el bloqueo/activación sea 100% en tiempo real.
 */
export async function updateTenantStatusAction(
  tenantId: string,
  status: "active" | "inactive" | "suspended" | "trial"
) {
  try {
    const updated = await MarketOSRepository.updateTenantStatus(tenantId, status);
    const currentUser = await getCurrentUser();
    await MarketOSRepository.recordAuditLog({
      tenantId,
      actorId: currentUser?.id,
      actorName: currentUser?.full_name,
      actorEmail: currentUser?.email,
      actorRole: currentUser?.role,
      action: "TENANT_STATUS_CHANGED",
      entity: "tenants",
      entityId: tenantId,
      newData: { status },
    });
    // Invalida Next.js Data Cache para este tenant (información, configuración, productos)
    invalidateTenantCache(tenantId);
    // Revalidación inmediata de rutas
    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/platform");
    return { success: updated };
  } catch (error) {
    console.error("Error updating tenant status:", error);
    return { success: false, error: "Error al actualizar estado del comercio" };
  }
}

/**
 * Renovar o registrar pago de suscripción SaaS de un comercio
 */
export async function renewTenantSubscriptionAction(
  tenantId: string,
  durationDays: number = 30,
  paymentMethod: string = "PAGO_MOVIL",
  reference?: string
) {
  try {
    const subscription = await MarketOSRepository.renewTenantSubscription(
      tenantId,
      durationDays,
      paymentMethod,
      reference
    );
    const currentUser = await getCurrentUser();
    await MarketOSRepository.recordAuditLog({
      tenantId,
      actorId: currentUser?.id,
      actorName: currentUser?.full_name,
      actorEmail: currentUser?.email,
      actorRole: currentUser?.role,
      action: "SUBSCRIPTION_RENEWED",
      entity: "subscriptions",
      entityId: tenantId,
      newData: { durationDays, paymentMethod, reference },
    });
    // Purgar caché y revalidar para que vuelva a estar en línea al instante
    invalidateTenantCache(tenantId);
    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/platform");
    return { success: true, subscription };
  } catch (error) {
    console.error("Error renewing tenant subscription:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al renovar la suscripción",
    };
  }
}

/**
 * Cambiar de plan SaaS para un comercio
 */
export async function changeTenantPlanAction(
  tenantId: string,
  planTier: SubscriptionPlanTier
) {
  try {
    const subscription = await MarketOSRepository.changeTenantPlan(tenantId, planTier);
    const currentUser = await getCurrentUser();
    await MarketOSRepository.recordAuditLog({
      tenantId,
      actorId: currentUser?.id,
      actorName: currentUser?.full_name,
      actorEmail: currentUser?.email,
      actorRole: currentUser?.role,
      action: "SUBSCRIPTION_PLAN_CHANGED",
      entity: "subscriptions",
      entityId: tenantId,
      newData: { planTier },
    });
    invalidateTenantCache(tenantId);
    revalidatePath("/platform");
    revalidatePath("/admin");
    return { success: true, subscription };
  } catch (error) {
    console.error("Error changing tenant plan:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al cambiar de plan",
    };
  }
}

/**
 * Fetch Global Audit Logs with full multi-tenant filtering (Super Admin)
 */
export async function getGlobalAuditLogsAction(filters?: AuditLogFilters) {
  try {
    const logs = await MarketOSRepository.getGlobalAuditLogs(filters);
    return { success: true, logs };
  } catch (error) {
    console.error("Error fetching global audit logs:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al obtener registros de auditoría",
      logs: [],
    };
  }
}

/**
 * Create a new user profile across the platform or assigned to a tenant
 */
export async function createPlatformUserAction(input: import("@marketos/types").CreatePlatformUserInput) {
  try {
    const user = await MarketOSRepository.createPlatformUser(input);
    revalidatePath("/platform");
    return { success: true, user };
  } catch (error) {
    console.error("Error creating platform user:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al registrar usuario",
    };
  }
}

/**
 * Update user role or tenant assignment
 */
export async function updateUserProfileAction(
  userId: string,
  data: Partial<import("@marketos/types").UserProfile>
) {
  try {
    const updated = await MarketOSRepository.updateUserProfile(userId, data);
    revalidatePath("/platform");
    return { success: !!updated, user: updated };
  } catch (error) {
    console.error("Error updating user profile:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al actualizar usuario",
    };
  }
}

/**
 * Delete or revoke a user profile
 */
export async function deletePlatformUserAction(userId: string) {
  try {
    const deleted = await MarketOSRepository.deleteUserProfile(userId);
    revalidatePath("/platform");
    return { success: deleted };
  } catch (error) {
    console.error("Error deleting user profile:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al eliminar usuario",
    };
  }
}

/**
 * Obtener Inteligencia de Negocios y Métricas Globales (BI Analytics)
 */
export async function getPlatformBiAnalyticsAction(
  filter: PlatformBiAnalyticsFilter | "today" | "week" | "month" | "all" = "all"
) {
  try {
    const analytics = await MarketOSRepository.getPlatformBiAnalytics(filter);
    return { success: true, analytics };
  } catch (error) {
    console.error("Error fetching platform BI analytics:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al cargar la analítica de negocio global",
    };
  }
}

