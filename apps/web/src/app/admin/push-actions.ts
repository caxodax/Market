"use server";

import { MarketOSRepository } from "@marketos/database";
import { sendTenantPushBroadcast } from "@/lib/pushNotifications";
import type {
  SavePushSubscriptionInput,
  SendPushBroadcastInput,
  PushStats,
  PushNotificationLog,
} from "@marketos/types";
import { revalidatePath } from "next/cache";

/**
 * Guardar o actualizar la suscripción push de un cliente (aislada por tenant).
 */
export async function savePushSubscriptionAction(input: SavePushSubscriptionInput) {
  try {
    const record = await MarketOSRepository.savePushSubscription(input);
    return { success: true, record };
  } catch (error) {
    console.error("[MarketOS] Error guardando suscripción push:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo registrar la suscripción push en el servidor.",
    };
  }
}

/**
 * Enviar transmisión masiva de notificaciones push para una tienda (tenant).
 */
export async function sendPushBroadcastAction(input: SendPushBroadcastInput) {
  try {
    const result = await sendTenantPushBroadcast(input);
    revalidatePath("/admin");
    return result;
  } catch (error) {
    console.error("[MarketOS] Error enviando difusión push:", error);
    return {
      success: false,
      sentCount: 0,
      totalTargeted: 0,
      error:
        error instanceof Error
          ? error.message
          : "Fallo inesperado al enviar las notificaciones push.",
    };
  }
}

/**
 * Obtener estadísticas de suscriptores y envíos para el panel administrativo.
 */
export async function getPushStatsAction(tenantId: string): Promise<PushStats> {
  try {
    return await MarketOSRepository.getPushStats(tenantId);
  } catch (error) {
    console.error("[MarketOS] Error obteniendo estadísticas push:", error);
    return {
      subscriberCount: 0,
      totalSentCount: 0,
      lastSentAt: null,
    };
  }
}

/**
 * Obtener historial de difusiones para la tienda.
 */
export async function getPushLogsAction(
  tenantId: string
): Promise<PushNotificationLog[]> {
  try {
    return await MarketOSRepository.getPushNotificationLogs(tenantId);
  } catch (error) {
    console.error("[MarketOS] Error obteniendo historial de difusiones:", error);
    return [];
  }
}
