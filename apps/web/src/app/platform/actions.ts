"use server";

import { MarketOSRepository } from "@marketos/database";
import { signSessionPayload, verifySessionPayload } from "@marketos/auth";
import {
  OnboardTenantInput,
  SubscriptionPlanTier,
  AuditLogFilters,
  PlatformBiAnalyticsFilter,
  ImpersonationSession,
  PlatformSettings,
  UpdatePlatformSettingsInput,
} from "@marketos/types";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
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

/**
 * Iniciar sesión de soporte / impersonación técnica ("Login As")
 * Permite al Super Admin ingresar al panel /admin de cualquier comercio con 1 solo clic como si fuera el dueño.
 */
export async function impersonateTenantAction(tenantId: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "PLATFORM_SUPER_ADMIN") {
      return {
        success: false,
        error:
          "Acceso no autorizado: Solo un Super Administrador de la plataforma puede impersonar comercios.",
      };
    }

    const tenant = await MarketOSRepository.getTenant(tenantId);
    if (!tenant) {
      return {
        success: false,
        error: `No se encontró el comercio con identificador: ${tenantId}`,
      };
    }

    const impersonationSession: ImpersonationSession = {
      originalSuperAdmin: {
        id: currentUser.id,
        email: currentUser.email,
        fullName: currentUser.full_name,
        role: currentUser.role,
      },
      targetTenantId: tenant.id,
      targetTenantName: tenant.name,
      targetTenantSlug: tenant.slug,
      startedAt: new Date().toISOString(),
    };

    const cookieStore = await cookies();
    cookieStore.set(
      "marketos_impersonation",
      signSessionPayload(impersonationSession),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 8, // 8 horas de sesión de soporte
        path: "/",
      }
    );

    // Bitácora de Auditoría Global (Audit Trail)
    await MarketOSRepository.recordAuditLog({
      tenantId: tenant.id,
      tenantName: tenant.name,
      actorId: currentUser.id,
      actorName: currentUser.full_name,
      actorEmail: currentUser.email,
      actorRole: currentUser.role,
      action: "SUPPORT_IMPERSONATION_STARTED",
      entity: "tenants",
      entityId: tenant.id,
      newData: {
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        impersonatedBy: currentUser.email,
        actorRole: currentUser.role,
        purpose: "Resolución de incidencias técnicas sin solicitud de contraseña (Login As)",
      },
    });

    revalidatePath("/admin");
    revalidatePath("/platform");

    return {
      success: true,
      redirectUrl: `/admin?tenant=${tenant.id}`,
    };
  } catch (error) {
    console.error("Error in impersonateTenantAction:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al iniciar impersonación de soporte",
    };
  }
}

/**
 * Salir del modo de impersonación y regresar a la consola de Super Admin
 */
export async function stopImpersonationAction() {
  try {
    const cookieStore = await cookies();
    const impersonationCookie = cookieStore.get("marketos_impersonation")?.value;

    if (impersonationCookie) {
      try {
        const parsed = verifySessionPayload<ImpersonationSession>(impersonationCookie);
        if (parsed) {
          await MarketOSRepository.recordAuditLog({
            tenantId: parsed.targetTenantId,
            tenantName: parsed.targetTenantName,
            actorId: parsed.originalSuperAdmin.id,
            actorName: parsed.originalSuperAdmin.fullName,
            actorEmail: parsed.originalSuperAdmin.email,
            actorRole: parsed.originalSuperAdmin.role,
            action: "SUPPORT_IMPERSONATION_ENDED",
            entity: "tenants",
            entityId: parsed.targetTenantId,
            newData: {
              tenantName: parsed.targetTenantName,
              endedAt: new Date().toISOString(),
            },
          });
        }
      } catch (err) {
        console.error("Error logging stop impersonation audit:", err);
      }
      cookieStore.delete("marketos_impersonation");
    }

    revalidatePath("/admin");
    revalidatePath("/platform");

    return {
      success: true,
      redirectUrl: "/platform",
    };
  } catch (error) {
    console.error("Error stopping impersonation:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al salir del modo de soporte",
    };
  }
}

/**
 * Forzar sincronización y escaneo en vivo de la telemetría de almacenamiento Cloudflare R2
 */
export async function refreshStorageTelemetryAction() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "PLATFORM_SUPER_ADMIN") {
      return { success: false, error: "No autorizado. Solo Super Admin puede refrescar telemetría R2." };
    }

    const telemetry = await MarketOSRepository.getPlatformStorageTelemetry(true);
    revalidatePath("/platform");

    return {
      success: true,
      telemetry,
    };
  } catch (error) {
    console.error("Error refreshing Cloudflare R2 telemetry:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al sincronizar con Cloudflare R2",
    };
  }
}

/**
 * Obtener detalle y lista de archivos de Cloudflare R2 para una tienda específica
 */
export async function getTenantStorageDetailsAction(tenantId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "No autenticado" };
    }

    if (user.role !== "PLATFORM_SUPER_ADMIN" && user.tenant_id !== tenantId) {
      return { success: false, error: "No autorizado para ver archivos de esta tienda" };
    }

    const telemetry = await MarketOSRepository.getTenantStorageTelemetry(tenantId, false);

    return {
      success: true,
      telemetry,
    };
  } catch (error) {
    console.error("Error fetching tenant storage details:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al consultar archivos en Cloudflare R2",
    };
  }
}

/**
 * Obtener ajustes globales de la plataforma SaaS (White-label, Canales de Soporte y Marca)
 */
export async function getPlatformSettingsAction() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "PLATFORM_SUPER_ADMIN") {
      return { success: false, error: "No autorizado. Solo Super Admin puede ver ajustes de plataforma." };
    }

    const settings = await MarketOSRepository.getPlatformSettings();
    return { success: true, settings };
  } catch (error) {
    console.error("Error fetching platform settings:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al consultar ajustes de plataforma",
    };
  }
}

/**
 * Actualizar ajustes globales de la plataforma SaaS (White-label, Canales de Soporte y Marca)
 */
export async function updatePlatformSettingsAction(data: UpdatePlatformSettingsInput) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "PLATFORM_SUPER_ADMIN") {
      return { success: false, error: "No autorizado. Solo Super Admin puede actualizar ajustes de plataforma." };
    }

    const updated = await MarketOSRepository.updatePlatformSettings(data);

    await MarketOSRepository.recordAuditLog({
      tenantId: "platform",
      tenantName: "Plataforma Global",
      actorId: currentUser.id,
      actorName: currentUser.full_name,
      actorEmail: currentUser.email,
      actorRole: currentUser.role,
      action: "SETTINGS_UPDATED",
      entity: "platform_settings",
      entityId: "default",
      newData: data,
    });

    revalidatePath("/platform");
    revalidatePath("/login");

    return { success: true, settings: updated };
  } catch (error) {
    console.error("Error updating platform settings:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al guardar ajustes de plataforma",
    };
  }
}

/**
 * Subir logotipo oficial de la plataforma SaaS a Cloudflare R2
 */
export async function uploadPlatformLogoAction(formData: FormData) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "PLATFORM_SUPER_ADMIN") {
      return { success: false, error: "No autorizado. Solo Super Admin puede subir logo de plataforma." };
    }

    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      return { success: false, error: "No se seleccionó ninguna imagen de logo" };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { uploadToR2, formatMediaUrl } = await import("@marketos/utils");
    const res = await uploadToR2({
      tenantId: "platform",
      folder: "branding",
      fileName: file.name || "platform-logo.webp",
      body: buffer,
      contentType: file.type || "image/webp",
    });

    const safeUrl = formatMediaUrl(res.url);

    return { success: true, url: safeUrl, key: res.key };
  } catch (error) {
    console.error("Error uploading platform logo to R2:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al subir logo de plataforma a Cloudflare R2",
    };
  }
}



