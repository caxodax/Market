import type {
  FintechPaymentLink,
  GeneratePaymentLinkInput,
} from "@marketos/types";

/**
 * Calcula la comisión de venta aplicando porcentaje y redondeo financiero.
 */
export function calculateSalesCommission(
  saleAmount: number,
  ratePercent: number
): number {
  if (saleAmount <= 0 || ratePercent <= 0) return 0;
  return Number(((saleAmount * ratePercent) / 100).toFixed(2));
}

/**
 * Genera enlaces de pago y datos QR para billeteras y pasarelas fintech venezolanas
 * (Cashea BNPL, Biopago BDV, Spidi, WayuPay y Pago Móvil).
 */
export function generateFintechPaymentLink(
  input: GeneratePaymentLinkInput
): FintechPaymentLink {
  const {
    tenantId,
    tenantName,
    orderId,
    provider,
    amountUsd,
    exchangeRateBcv = 875.65,
    customerName,
    customerPhone,
    merchantCredentials,
  } = input;

  const amountVes = Number((amountUsd * exchangeRateBcv).toFixed(2));
  const linkId = `link_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  // Vence en 24 horas por defecto
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  switch (provider) {
    case "CASHEA": {
      const mid = merchantCredentials?.casheaMerchantId || encodeURIComponent(tenantName);
      const url = `https://app.cashea.com/pay?merchant=${mid}&order=${encodeURIComponent(orderId)}&amount=${amountUsd.toFixed(2)}&currency=USD`;
      return {
        id: linkId,
        tenant_id: tenantId,
        provider: "CASHEA",
        url,
        qr_data: url,
        amount: amountUsd,
        currency: "USD",
        reference: orderId,
        description: `Pago en 3 cuotas sin interés Cashea - Orden #${orderId}`,
        customer_name: customerName,
        customer_phone: customerPhone,
        expires_at: expiresAt,
        created_at: now,
      };
    }

    case "BIOPAGO_BDV": {
      const term = merchantCredentials?.biopagoTerminalId || "TER-BDV-001";
      const qrData = `bdv:biopago?terminal=${term}&ref=${orderId}&amount=${amountVes.toFixed(2)}&curr=VES`;
      const url = `https://pagos.banvenez.com/biopago?t=${term}&ref=${orderId}&amt=${amountVes.toFixed(2)}`;
      return {
        id: linkId,
        tenant_id: tenantId,
        provider: "BIOPAGO_BDV",
        url,
        qr_data: qrData,
        amount: amountVes,
        currency: "VES",
        reference: orderId,
        description: `Cobro Biopago BDV Huella / Tarjeta - Orden #${orderId}`,
        customer_name: customerName,
        customer_phone: customerPhone,
        expires_at: expiresAt,
        created_at: now,
      };
    }

    case "SPIDI":
    case "WAYUPAY": {
      const baseUrl = provider === "SPIDI" ? "https://pay.spidi.app" : "https://checkout.wayupay.com";
      const url = `${baseUrl}/checkout?merchant=${tenantId}&order=${encodeURIComponent(orderId)}&amount=${amountUsd.toFixed(2)}`;
      return {
        id: linkId,
        tenant_id: tenantId,
        provider,
        url,
        qr_data: url,
        amount: amountUsd,
        currency: "USD",
        reference: orderId,
        description: `Enlace de pago digital ${provider} - Orden #${orderId}`,
        customer_name: customerName,
        customer_phone: customerPhone,
        expires_at: expiresAt,
        created_at: now,
      };
    }

    case "PAGO_MOVIL":
    default: {
      const qrData = `pagomovil:tenant=${tenantId}&order=${orderId}&amount=${amountVes.toFixed(2)}`;
      const url = `https://wa.me/?text=${encodeURIComponent(`Hola ${customerName || ""}, tu orden #${orderId} por Bs. ${amountVes.toFixed(2)} está lista para pagar vía Pago Móvil.`)}`;
      return {
        id: linkId,
        tenant_id: tenantId,
        provider: "PAGO_MOVIL",
        url,
        qr_data: qrData,
        amount: amountVes,
        currency: "VES",
        reference: orderId,
        description: `Pago Móvil Interbancario - Orden #${orderId}`,
        customer_name: customerName,
        customer_phone: customerPhone,
        expires_at: expiresAt,
        created_at: now,
      };
    }
  }
}

/**
 * Genera el enlace de WhatsApp con el mensaje pre-redactado para enviar al cliente.
 */
export function buildFintechWhatsAppShareMessage(
  link: FintechPaymentLink,
  phone?: string
): string {
  const providerLabel =
    link.provider === "CASHEA"
      ? "Cashea (Compre ahora, pague después en cuotas)"
      : link.provider === "BIOPAGO_BDV"
        ? "Biopago Banco de Venezuela"
        : link.provider;

  const amountStr =
    link.currency === "USD"
      ? `$${link.amount.toFixed(2)}`
      : `Bs. ${link.amount.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const text = `¡Hola${link.customer_name ? ` ${link.customer_name}` : ""}! Aquí tienes el link para completar tu pago de ${amountStr} vía *${providerLabel}* para la referencia *#${link.reference}*:\n\n🔗 ${link.url}\n\nUna vez procesado, tu pedido será despachado inmediatamente.`;

  const cleanPhone = phone ? phone.replace(/[^0-9]/g, "") : "";
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  }
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
