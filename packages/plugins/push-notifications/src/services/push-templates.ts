import type { PushSubscriptionRecord } from "@marketos/types";

export type PushTargetType = "all" | "with_orders" | "without_orders" | string;

export interface OrderStatusPushParams {
  orderNumber: string;
  status: string;
  storeName?: string;
  driverName?: string;
  rejectionReason?: string;
}

export interface FormattedPushNotification {
  title: string;
  body: string;
  url: string;
  tag: string;
  icon?: string;
  badge?: string;
}

/**
 * Genera el payload de notificación push personalizado según el estado del pedido.
 */
export function buildOrderStatusPushPayload(
  params: OrderStatusPushParams
): FormattedPushNotification {
  const {
    orderNumber,
    status,
    storeName = "MarketOS",
    driverName,
    rejectionReason,
  } = params;

  let title = `Actualización de tu Pedido #${orderNumber}`;
  let body = `El estado de tu pedido ha cambiado a: ${status}.`;

  switch (status) {
    case "APPROVED":
    case "PAYMENT_APPROVED":
      title = `🎉 ¡Pago Aprobado! (#${orderNumber})`;
      body = `Tu comprobante ha sido verificado en ${storeName}. Tu pedido está en preparación.`;
      break;
    case "REJECTED":
      title = `⚠️ Aviso sobre tu pago (#${orderNumber})`;
      body = rejectionReason
        ? `El pago no pudo verificarse: ${rejectionReason}. Por favor contáctanos.`
        : `El comprobante de tu pedido no pudo ser validado. Por favor contáctanos.`;
      break;
    case "PREPARING":
      title = `📦 Preparando tu Pedido (#${orderNumber})`;
      body = `Estamos empacando tus productos cuidadosamente en ${storeName}.`;
      break;
    case "READY":
      title = `🛍️ ¡Pedido Listo! (#${orderNumber})`;
      body = `Tu pedido está listo para ser despachado o retirado en tienda.`;
      break;
    case "DELIVERING":
      title = `🛵 ¡Tu pedido va en camino! (#${orderNumber})`;
      body = driverName
        ? `El repartidor ${driverName} está en ruta hacia tu dirección.`
        : `El repartidor está en ruta hacia tu dirección de entrega.`;
      break;
    case "COMPLETED":
      title = `✅ ¡Pedido Entregado con Éxito! (#${orderNumber})`;
      body = `Gracias por tu compra en ${storeName}. ¡Esperamos que disfrutes tus productos!`;
      break;
    case "CANCELLED":
      title = `Aviso: Pedido Cancelado (#${orderNumber})`;
      body = `Tu pedido ha sido cancelado en ${storeName}.`;
      break;
  }

  return {
    title,
    body,
    url: `/?order=${encodeURIComponent(orderNumber)}`,
    tag: `order-${orderNumber}`,
    icon: "/icon-192.png",
    badge: "/apple-touch-icon.png",
  };
}

/**
 * Filtra suscriptores push según el segmento seleccionado (todos, con pedidos, sin pedidos).
 */
export function filterPushSubscriptions(
  subscriptions: PushSubscriptionRecord[],
  targetType: PushTargetType = "all"
): PushSubscriptionRecord[] {
  if (targetType === "with_orders") {
    return subscriptions.filter((s) => Boolean(s.customer_id));
  }
  if (targetType === "without_orders") {
    return subscriptions.filter((s) => !s.customer_id);
  }
  return subscriptions;
}

/**
 * Plantillas preconfiguradas para campañas de marketing en 1 clic
 */
export const PUSH_MARKETING_PRESETS = [
  {
    id: "FLASH_SALE",
    label: "🔥 Oferta Relámpago",
    title: "¡24h de Descuento Exclusivo! ⚡",
    body: "Aprovecha precios especiales en todo nuestro catálogo solo por hoy. ¡No te quedes sin stock!",
    url: "/",
  },
  {
    id: "NEW_ARRIVALS",
    label: "✨ Novedades",
    title: "¡Nuevos Productos Disponibles! 🛍️",
    body: "Acabamos de renovar nuestro catálogo con los artículos más pedidos. ¡Míralos ahora!",
    url: "/",
  },
  {
    id: "FREE_SHIPPING",
    label: "🛵 Envío Gratis",
    title: "¡Delivery Gratis en tu Compra! 🛵",
    body: "Pide hoy y recibe tus productos en la puerta de tu casa sin costo de envío adicional.",
    url: "/",
  },
  {
    id: "WEEKEND_PROMO",
    label: "🎉 Fin de Semana",
    title: "¡Fin de Semana de Ahorro! 🌟",
    body: "Haz tu pedido hoy y disfruta de promociones exclusivas para suscriptores móviles.",
    url: "/",
  },
];
