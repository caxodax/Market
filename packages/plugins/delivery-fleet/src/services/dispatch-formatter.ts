import { Order, Driver, extractGpsCoordinates } from "@marketos/types";

export interface DriverDispatchPayload {
  order: Order;
  driver: Driver;
  storeName?: string;
}

/**
 * Builds a direct Google Maps search / navigation URL for an address or GPS point.
 */
export function buildGoogleMapsUrl(address: string, order?: Order): string {
  if (order?.delivery_maps_url) {
    return order.delivery_maps_url;
  }
  if (order?.delivery_latitude != null && order?.delivery_longitude != null) {
    return `https://www.google.com/maps?q=${order.delivery_latitude},${order.delivery_longitude}`;
  }
  const gpsInfo = extractGpsCoordinates(address);
  if (gpsInfo.mapsUrl) {
    return gpsInfo.mapsUrl;
  }
  const cleanAddr = (gpsInfo.cleanAddress || address).trim();
  if (!cleanAddr) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanAddr)}`;
}

/**
 * Sanitizes phone numbers to standard WhatsApp wa.me format (digits only).
 */
export function sanitizeWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // If starts with 0 (e.g. 0412... in Venezuela), replace leading 0 with 58
  if (digits.startsWith("0") && digits.length === 11) {
    return `58${digits.slice(1)}`;
  }
  return digits;
}

/**
 * Generates an operational comanda message for the driver with full delivery context.
 */
export function formatDriverWhatsAppDispatchMessage({
  order,
  driver,
  storeName = "MarketOS Store",
}: DriverDispatchPayload): string {
  const lines: string[] = [];

  lines.push(`🛵 *NUEVO DESPACHO ASIGNADO*`);
  lines.push(`🏪 *Tienda:* ${storeName}`);
  lines.push(`👤 *Chofer:* ${driver.name} (${driver.vehicle_type}${driver.plate_number ? ` - ${driver.plate_number}` : ""})`);
  lines.push(`────────────────────────`);
  lines.push(`📦 *Orden:* #${order.order_number}`);
  lines.push(`👤 *Cliente:* ${order.customer_name || "Cliente"}`);
  lines.push(`📞 *Teléfono:* ${order.customer_phone || "No especificado"}`);
  
  const gpsInfo = extractGpsCoordinates(order.delivery_address);
  const displayAddress = gpsInfo.cleanAddress || (order.delivery_address?.trim() || "Dirección no especificada");
  const exactLat = gpsInfo.lat ?? order.delivery_latitude ?? null;
  const exactLng = gpsInfo.lng ?? order.delivery_longitude ?? null;
  const hasExactGps = exactLat !== null && exactLng !== null;

  lines.push(`📍 *Dirección de Entrega:* ${displayAddress}`);

  const finalMapsUrl = hasExactGps
    ? `https://www.google.com/maps?q=${exactLat},${exactLng}`
    : (order.delivery_maps_url || buildGoogleMapsUrl(displayAddress, order));

  if (finalMapsUrl) {
    if (hasExactGps) {
      lines.push(`🛰️ *PIN GPS EXACTO DEL CLIENTE:* ${finalMapsUrl}`);
    } else {
      lines.push(`🗺️ *Ruta Google Maps:* ${finalMapsUrl}`);
    }
  }

  lines.push(`────────────────────────`);
  lines.push(`📋 *PRODUCTOS A ENTREGAR:*`);
  if (order.items && order.items.length > 0) {
    for (const item of order.items) {
      lines.push(` • ${item.quantity}x ${item.product_name} ($${(item.unit_price_usd * item.quantity).toFixed(2)})`);
      if (item.selected_modifiers && item.selected_modifiers.length > 0) {
        for (const mod of item.selected_modifiers) {
          lines.push(`   └ ${mod.group_name}: ${mod.option_name}`);
        }
      }
    }
  } else {
    lines.push(` • Ver comanda física o detalle en sistema`);
  }

  lines.push(`────────────────────────`);
  lines.push(`💰 *INFORMACIÓN DE PAGO:*`);
  lines.push(` • Total Pedido: $${order.total_usd.toFixed(2)}${order.total_ves ? ` (Bs. ${order.total_ves.toFixed(2)})` : ""}`);

  if (order.payment_method === "CASH_USD" || order.payment_method === "CASH_VES") {
    lines.push(` • Método: Efectivo a contraentrega (${order.payment_method === "CASH_USD" ? "Dólares" : "Bolívares"})`);
    if (order.cash_tendered_usd && order.cash_tendered_usd > 0) {
      lines.push(` • 💵 *El cliente paga con:* $${order.cash_tendered_usd.toFixed(2)}`);
      const changeDue = order.change_required_usd ?? Math.max(0, order.cash_tendered_usd - order.total_usd);
      lines.push(` • 🔄 *Llevar cambio / vuelto:* $${changeDue.toFixed(2)}`);
    } else {
      lines.push(` • ⚠️ Cobrar el monto total exacto al entregar`);
    }
  } else {
    const isPaid = order.payment_status === "APPROVED";
    lines.push(` • Método: ${order.payment_method || "Digital"}`);
    lines.push(` • Estado: ${isPaid ? "✅ PAGADO / NO COBRAR" : "⏳ Pago pendiente por confirmar"}`);
  }

  if (order.notes?.trim()) {
    lines.push(`────────────────────────`);
    lines.push(`📝 *Notas:* ${order.notes.trim()}`);
  }

  lines.push(`────────────────────────`);
  lines.push(`Por favor confirmar recepción y salida a ruta. ¡Maneja seguro! 🛵💨`);

  return lines.join("\n");
}

/**
 * Builds the wa.me link to open WhatsApp with the pre-filled dispatch message.
 */
export function buildDriverWhatsAppDispatchUrl(payload: DriverDispatchPayload): string {
  const cleanPhone = sanitizeWhatsAppPhone(payload.driver.phone);
  const message = formatDriverWhatsAppDispatchMessage(payload);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
