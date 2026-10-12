import webpush from "web-push";
import { MarketOSRepository } from "@marketos/database";
import type { PushNotificationLog, SendPushBroadcastInput } from "@marketos/types";

// Inicializar configuración VAPID
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const privateKey = process.env.VAPID_PRIVATE_KEY || "";
const subject = process.env.VAPID_SUBJECT || "mailto:admin@marketos.app";

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
  const { tenantId, title, body, url, icon, badge, tag, createdBy } = input;

  // 1. Obtener suscriptores activos exclusivos de este tenant
  const subscriptions = await MarketOSRepository.getPushSubscriptions(tenantId);

  if (!subscriptions || subscriptions.length === 0) {
    return {
      success: true,
      sentCount: 0,
      totalTargeted: 0,
      message: "Aún no hay clientes con notificaciones activadas para esta tienda.",
    };
  }

  // 2. Enviar en paralelo a todas las suscripciones activas
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
    targetType: "all",
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
    const subscriptions = await MarketOSRepository.getPushSubscriptions(tenantId);
    // Filtrar suscriptores asociados al teléfono o ID del cliente
    const targetSubs = subscriptions.filter(
      (s) =>
        (customerId && s.customer_id === customerId) ||
        (customerPhone && s.customer_id === customerPhone)
    );

    if (targetSubs.length === 0) return;

    let title = `Actualización de tu Pedido #${orderNumber}`;
    let body = `El estado de tu pedido ha cambiado a: ${status}.`;

    switch (status) {
      case "APPROVED":
      case "PAYMENT_APPROVED":
        title = `🎉 ¡Pago Aprobado! (${orderNumber})`;
        body = `Tu comprobante ha sido verificado en ${storeName}. Tu pedido está en preparación.`;
        break;
      case "REJECTED":
        title = `⚠️ Aviso sobre tu pago (${orderNumber})`;
        body = rejectionReason
          ? `El pago no pudo verificarse: ${rejectionReason}. Por favor contáctanos.`
          : `El comprobante de tu pedido no pudo ser validado. Por favor contáctanos.`;
        break;
      case "PREPARING":
        title = `📦 Preparando tu Pedido (${orderNumber})`;
        body = `Estamos empacando tus productos cuidadosamente en ${storeName}.`;
        break;
      case "READY":
        title = `🛍️ ¡Pedido Listo! (${orderNumber})`;
        body = `Tu pedido está listo para ser despachado o retirado en tienda.`;
        break;
      case "DELIVERING":
        title = `🛵 ¡Tu pedido va en camino! (${orderNumber})`;
        body = driverName
          ? `El repartidor ${driverName} está en ruta hacia tu dirección.`
          : `El repartidor está en ruta hacia tu dirección de entrega.`;
        break;
      case "COMPLETED":
        title = `✅ ¡Pedido Entregado con Éxito! (${orderNumber})`;
        body = `Gracias por tu compra en ${storeName}. ¡Esperamos que disfrutes tus productos!`;
        break;
      case "CANCELLED":
        title = `Aviso: Pedido Cancelado (${orderNumber})`;
        body = `Tu pedido ha sido cancelado en ${storeName}.`;
        break;
    }

    await Promise.allSettled(
      targetSubs.map((sub) =>
        sendSinglePushNotification(
          {
            endpoint: sub.endpoint,
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
          {
            title,
            body,
            url: `/?order=${orderNumber}`,
            icon: "/icon-192.png",
            badge: "/apple-touch-icon.png",
            tag: `order-${orderNumber}`,
          }
        )
      )
    );
  } catch (err) {
    console.warn("[MarketOS Push] Error enviando push de estado de pedido:", err);
  }
}
