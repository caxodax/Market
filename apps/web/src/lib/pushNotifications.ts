import webpush from "web-push";
import { MarketOSRepository } from "@marketos/database";
import type { PushNotificationLog, SendPushBroadcastInput } from "@marketos/types";
import {
  DEFAULT_VAPID_PUBLIC_KEY,
  DEFAULT_VAPID_PRIVATE_KEY,
  DEFAULT_VAPID_SUBJECT,
} from "./push-constants";
import {
  buildOrderStatusPushPayload,
  filterPushSubscriptions,
} from "@marketos/plugin-push-notifications";

// Inicializar configuración VAPID
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY || DEFAULT_VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || DEFAULT_VAPID_SUBJECT;

if (publicKey && privateKey) {
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch (e) {
    console.warn("[MarketOS Push] Error configurando VAPID:", e);
  }
}

export interface PushMessagePayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
}

/**
 * Enviar notificación push a una suscripción individual.
 * Si el navegador responde con 404 Not Found o 410 Gone (la suscripción expiró o fue eliminada),
 * purga automáticamente el registro para mantener la base de datos limpia.
 */
export async function sendSinglePushNotification(
  subscription: {
    endpoint: string;
    p256dh: string;
    auth: string;
  },
  payload: PushMessagePayload
): Promise<{ success: boolean; error?: string }> {
  if (!publicKey || !privateKey) {
    console.error("[MarketOS Push] Claves VAPID no configuradas en el entorno");
    return { success: false, error: "VAPID no configurado en el servidor." };
  }

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  try {
    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url || "/",
        icon: payload.icon || "/brand/logo.png",
        badge: payload.badge || "/brand/logo.png",
        tag: payload.tag || "marketos-broadcast",
      })
    );
    return { success: true };
  } catch (error: any) {
    // Si la suscripción fue revocada o ya no existe (404 o 410 Gone)
    if (error.statusCode === 404 || error.statusCode === 410) {
      try {
        await MarketOSRepository.deletePushSubscription(subscription.endpoint);
        console.info(`[MarketOS Push] Suscripción expirada purgada: ${subscription.endpoint}`);
      } catch (delErr) {
        console.warn("[MarketOS Push] Error purgando suscripción:", delErr);
      }
    }
    return { success: false, error: error.message || "Fallo en entrega de notificación" };
  }
}

/**
 * Enviar transmisión masiva de notificaciones push estrictamente aislada por tenant (tienda).
 */
export async function sendTenantPushBroadcast(
  input: SendPushBroadcastInput
): Promise<{
  success: boolean;
  sentCount: number;
  totalTargeted: number;
  message?: string;
  log?: PushNotificationLog;
}> {
  const { tenantId, title, body, url, icon, badge, tag, targetType = "all", createdBy } = input;

  // 0. Verificar si el tenant tiene activo el plugin de Notificaciones Push
  const isModuleActive = await MarketOSRepository.isModuleActiveForTenant(
    tenantId,
    "push_notifications"
  );
  if (!isModuleActive) {
    return {
      success: false,
      sentCount: 0,
      totalTargeted: 0,
      message: "El plugin de Notificaciones Push no está activado para esta tienda.",
    };
  }

  // 1. Obtener suscriptores activos exclusivos de este tenant
  const allSubscriptions = await MarketOSRepository.getPushSubscriptions(tenantId);

  if (!allSubscriptions || allSubscriptions.length === 0) {
    return {
      success: true,
      sentCount: 0,
      totalTargeted: 0,
      message: "Aún no hay clientes con notificaciones activadas para esta tienda.",
    };
  }

  // Segmentación por perfil de cliente usando helper del plugin
  const subscriptions = filterPushSubscriptions(allSubscriptions, targetType);

  if (subscriptions.length === 0) {
    return {
      success: true,
      sentCount: 0,
      totalTargeted: 0,
      message: `No se encontraron dispositivos en el segmento seleccionado (${targetType}).`,
    };
  }

  // 2. Enviar en paralelo a todas las suscripciones activas del segmento
  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      sendSinglePushNotification(
        {
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
        {
          title,
          body,
          url: url || "/",
          icon: icon || "/brand/logo.png",
          badge: badge || "/brand/logo.png",
          tag: tag || `tenant-${tenantId}-broadcast`,
        }
      )
    )
  );

  const sentCount = results.filter(
    (r) => r.status === "fulfilled" && r.value.success
  ).length;

  // 3. Registrar en la bitácora multi-inquilino
  const log = await MarketOSRepository.recordPushNotificationLog({
    tenantId,
    title,
    body,
    url: url || "/",
    targetType,
    sentCount,
    createdBy: createdBy || "Admin",
  });

  return {
    success: true,
    sentCount,
    totalTargeted: subscriptions.length,
    log,
  };
}

/**
 * Enviar notificación push automática al cliente sobre el cambio de estado de su pedido.
 */
export async function sendOrderStatusPushNotification(input: {
  tenantId: string;
  orderNumber: string;
  status: string;
  customerId?: string | null;
  customerPhone?: string | null;
  storeName?: string;
  driverName?: string;
  rejectionReason?: string;
}): Promise<void> {
  const {
    tenantId,
    orderNumber,
    status,
    customerId,
    customerPhone,
    storeName = "MarketOS",
    driverName,
    rejectionReason,
  } = input;

  try {
    // 0. Verificar si el tenant tiene activo el módulo de notificaciones push
    const isModuleActive = await MarketOSRepository.isModuleActiveForTenant(
      tenantId,
      "push_notifications"
    );
    if (!isModuleActive) return;

    const subscriptions = await MarketOSRepository.getPushSubscriptions(tenantId);
    // Filtrar suscriptores asociados al teléfono o ID del cliente
    const targetSubs = subscriptions.filter(
      (s) =>
        (customerId && s.customer_id === customerId) ||
        (customerPhone && s.customer_id === customerPhone)
    );

    if (targetSubs.length === 0) return;

    const payload = buildOrderStatusPushPayload({
      orderNumber,
      status,
      storeName,
      driverName,
      rejectionReason,
    });

    await Promise.allSettled(
      targetSubs.map((sub) =>
        sendSinglePushNotification(
          {
            endpoint: sub.endpoint,
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
          payload
        )
      )
    );
  } catch (err) {
    console.warn("[MarketOS Push] Error enviando push de estado de pedido:", err);
  }
}
