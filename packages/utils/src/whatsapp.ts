import { Order, OrderItem } from "@marketos/types";

export interface WhatsAppOrderInput {
  tenantPhone: string;
  businessName: string;
  order: Order;
  items?: { productName: string; quantity: number; unitPriceUsd: number }[];
  deliveryZoneName?: string;
  paymentMethod?: string;
  referenceNumber?: string;
}

export interface WhatsAppNotificationInput {
  customerName: string;
  customerPhone: string;
  businessName: string;
  orderNumber: string;
  status: Order["status"];
  deliveryType: Order["delivery_type"];
  driverName?: string | null;
  driverPhone?: string | null;
}

/**
 * Clean phone number to WhatsApp international standard (e.g. 584241234567)
 */
export function sanitizeWhatsAppPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  // If starts with 0 (e.g. 04241234567), replace with 584241234567
  if (cleaned.startsWith("0")) {
    cleaned = `58${cleaned.slice(1)}`;
  }
  // If starts with 4 (e.g. 4241234567), prefix 58
  if (cleaned.startsWith("4")) {
    cleaned = `58${cleaned}`;
  }
  return cleaned;
}

/**
 * Generate formatted WhatsApp link for customer sending order to store
 */
export function generateCustomerOrderWhatsAppLink({
  tenantPhone,
  businessName,
  order,
  items = [],
  deliveryZoneName,
  paymentMethod,
  referenceNumber,
}: WhatsAppOrderInput): string {
  const cleanPhone = sanitizeWhatsAppPhone(tenantPhone);

  const lines: string[] = [
    `🛒 *NUEVO PEDIDO - ${businessName.toUpperCase()}*`,
    `📋 *Número de Pedido:* #${order.order_number}`,
    `📅 *Fecha:* ${new Date(order.created_at).toLocaleString("es-VE")}`,
    "",
    `📍 *Modalidad:* ${order.delivery_type === "DELIVERY" ? "🛵 Delivery a Domicilio" : "🏪 Retiro en Tienda"}`,
  ];

  if (order.delivery_type === "DELIVERY") {
    if (deliveryZoneName) lines.push(`🗺️ *Zona:* ${deliveryZoneName}`);
    if (order.delivery_address) lines.push(`🏠 *Dirección:* ${order.delivery_address}`);
  }

  if (items.length > 0) {
    lines.push("");
    lines.push("📦 *Detalle del Pedido:*");
    items.forEach((item) => {
      lines.push(`• ${item.quantity}x ${item.productName} - $${(item.quantity * item.unitPriceUsd).toFixed(2)}`);
    });
  }

  if (order.delivery_fee_usd && order.delivery_fee_usd > 0) {
    lines.push(`🛵 *Costo de Delivery:* $${order.delivery_fee_usd.toFixed(2)}`);
  }

  if (order.discount_usd && order.discount_usd > 0) {
    lines.push(`🎟️ *Descuento Cupón:* -$${order.discount_usd.toFixed(2)}`);
  }

  lines.push("");
  lines.push(`💵 *Total USD:* $${order.total_usd.toFixed(2)}`);
  lines.push(`🇻🇪 *Total Bs. (Tasa BCV ${order.exchange_rate_applied.toFixed(2)}):* Bs. ${order.total_ves.toFixed(2)}`);

  if (paymentMethod || referenceNumber) {
    lines.push("");
    lines.push("💳 *Información de Pago:*");
    if (paymentMethod) lines.push(`• Método: ${paymentMethod}`);
    if (referenceNumber) lines.push(`• Referencia: ${referenceNumber}`);
  }

  if (order.notes) {
    lines.push("");
    lines.push(`📝 *Notas:* ${order.notes}`);
  }

  lines.push("");
  lines.push("¡Hola! Acabo de registrar mi pedido en la tienda web y adjunto mi confirmación. 🚀");

  const message = lines.join("\n");
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Generate formatted WhatsApp link for store admin notifying customer of status changes
 */
export function generateOrderStatusNotificationWhatsAppLink({
  customerName,
  customerPhone,
  businessName,
  orderNumber,
  status,
  deliveryType,
  driverName,
  driverPhone,
}: WhatsAppNotificationInput): string {
  const cleanPhone = sanitizeWhatsAppPhone(customerPhone);

  const statusDescriptions: Record<string, string> = {
    PAYMENT_APPROVED: "✅ *Tu pago ha sido validado con éxito.*",
    PREPARING: "👨‍🍳 *Estamos preparando y empacando tus productos.*",
    READY:
      deliveryType === "PICKUP"
        ? "🎁 *¡Tu pedido está LISTO para retirar en tienda!*"
        : "📦 *Tu pedido está listo esperando al repartidor.*",
    DELIVERING: "🛵 *¡Tu pedido va en camino a tu dirección!*",
    COMPLETED: "🎉 *¡Pedido entregado con éxito! Gracias por tu compra.*",
    CANCELLED: "❌ *Tu pedido ha sido cancelado.*",
  };

  const statusText = statusDescriptions[status] || `Estado actualizado: *${status}*`;

  const lines: string[] = [
    `¡Hola *${customerName}*! 👋`,
    "",
    `Te escribimos de *${businessName}* para informarte sobre tu pedido *#${orderNumber}*:`,
    "",
    statusText,
  ];

  if (status === "DELIVERING" && driverName) {
    lines.push("");
    lines.push(`🛵 *Repartidor asignado:* ${driverName}`);
    if (driverPhone) lines.push(`📞 *Contacto repartidor:* ${driverPhone}`);
  }

  lines.push("");
  lines.push("Si tienes alguna duda o requerimiento adicional, responde a este mensaje.");
  lines.push(`_Equipo de ${businessName}_`);

  const message = lines.join("\n");
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
