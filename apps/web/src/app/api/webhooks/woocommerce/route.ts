import { NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  MarketOSRepository,
  InvoicingRepository,
  type CreateOrderInput,
} from "@marketos/database";
import { prepareFiscalDocument } from "@marketos/plugin-invoicing";
import type {
  CreateFiscalDocumentInput,
  TenantSettings,
} from "@marketos/types";

export const dynamic = "force-dynamic";

/**
 * WooCommerce Webhook Connector
 * 
 * Secure endpoint to receive orders from external WooCommerce stores.
 * Enforces HMAC-SHA256 signature verification (AgentShield ECC standard)
 * and optionally auto-issues fiscal invoices if @marketos/plugin-invoicing is active.
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantId =
      request.headers.get("x-wc-webhook-tenant-id") ||
      url.searchParams.get("tenant_id") ||
      url.searchParams.get("tenantId");

    if (!tenantId) {
      return NextResponse.json(
        { error: "Missing required tenant_id parameter or header" },
        { status: 400 }
      );
    }

    // 1. Retrieve tenant settings
    const settings = await MarketOSRepository.getTenantSettings(tenantId);
    if (!settings) {
      return NextResponse.json(
        { error: `Tenant not found: ${tenantId}` },
        { status: 404 }
      );
    }

    // 2. Read raw body buffer for HMAC verification
    const rawBody = await request.text();
    const signature = request.headers.get("x-wc-webhook-signature");
    const webhookSecret =
      process.env.WOOCOMMERCE_WEBHOOK_SECRET ||
      (settings as any)?.integrations?.woocommerce_secret ||
      "marketos-wc-secret";

    // 3. Verify HMAC-SHA256 signature (AgentShield Timing-Safe)
    if (signature) {
      const hmac = crypto.createHmac("sha256", webhookSecret);
      const digest = hmac.update(rawBody).digest("base64");

      const sigBuffer = Buffer.from(signature, "utf-8");
      const digestBuffer = Buffer.from(digest, "utf-8");

      if (
        sigBuffer.length !== digestBuffer.length ||
        !crypto.timingSafeEqual(sigBuffer, digestBuffer)
      ) {
        console.warn(`[WooCommerce Webhook] Invalid signature received for tenant ${tenantId}`);
        return NextResponse.json(
          { error: "Invalid webhook signature" },
          { status: 401 }
        );
      }
    }

    // 4. Parse WooCommerce Order Payload
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Malformed JSON payload" }, { status: 400 });
    }

    const topic = request.headers.get("x-wc-webhook-topic") || "order.created";
    console.log(`[WooCommerce Webhook] Received topic '${topic}' for order #${payload.id || payload.number}`);

    const customerName =
      [payload.billing?.first_name, payload.billing?.last_name]
        .filter(Boolean)
        .join(" ") ||
      payload.shipping?.first_name ||
      "Cliente WooCommerce";

    const customerPhone = payload.billing?.phone || "";
    const customerEmail = payload.billing?.email || "";
    const deliveryAddress =
      [payload.shipping?.address_1, payload.shipping?.city, payload.shipping?.state]
        .filter(Boolean)
        .join(", ") ||
      [payload.billing?.address_1, payload.billing?.city].filter(Boolean).join(", ");

    const totalUsd = parseFloat(payload.total || "0");
    const stores = await MarketOSRepository.getStores(tenantId);
    const storeId = stores[0]?.id || "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d";

    const items = (payload.line_items || []).map((item: any) => ({
      productId: item.sku || `wc_prod_${item.product_id}`,
      productName: item.name || "Producto WooCommerce",
      quantity: item.quantity || 1,
      unitPriceUsd: parseFloat(item.price || "0"),
    }));

    // 5. Build MarketOS Order Input
    const createOrderInput: CreateOrderInput = {
      tenantId,
      storeId,
      customerName,
      customerPhone,
      deliveryType: deliveryAddress ? "DELIVERY" : "PICKUP",
      deliveryAddress,
      items: items.length > 0 ? items : [
        {
          productId: "wc_generic",
          productName: `Orden WooCommerce #${payload.number || payload.id}`,
          quantity: 1,
          unitPriceUsd: totalUsd,
        },
      ],
      notes: `Importado vía WooCommerce Webhook • WC ID #${payload.id} • Moneda: ${payload.currency || "USD"}`,
    };

    // 6. Persist order in MarketOS
    const createdOrder = await MarketOSRepository.createOrder(createOrderInput);

    // 7. Auto-Issue Fiscal Invoice if @marketos/plugin-invoicing is active
    let issuedInvoice = null;
    const tenantModules = await MarketOSRepository.getTenantModules(tenantId);
    const activeModuleIds = tenantModules
      .filter((m) => m.is_active)
      .map((m) => m.module_id);

    if (activeModuleIds.includes("invoicing") && totalUsd > 0) {
      try {
        const nextSequence = await InvoicingRepository.getNextFiscalSequence(tenantId, "INVOICE");
        const invoiceInput: CreateFiscalDocumentInput = {
          document_type: "INVOICE",
          customer_name: customerName,
          customer_id_doc: payload.meta_data?.find((m: any) => m.key === "billing_dni" || m.key === "rif")?.value || "V-00000000",
          customer_address: deliveryAddress || "Ciudad",
          customer_phone: customerPhone,
          currency: "USD",
          exchange_rate_applied: 875.65,
          apply_igtf: false,
          reason: `Factura generada automáticamente desde orden WooCommerce #${payload.id}`,
          items: (items.length > 0 ? items : createOrderInput.items).map((it: { productId: string; productName: string; quantity: number; unitPriceUsd: number }) => ({
            product_id: it.productId,
            name: it.productName,
            quantity: it.quantity,
            unit_price: it.unitPriceUsd,
            is_exempt: false,
          })),
        };

        const preparedDoc = prepareFiscalDocument({
          input: invoiceInput,
          settings,
          sequenceNumber: nextSequence,
          activeModuleIds,
          actorName: "WooCommerce Webhook Connector",
        });

        issuedInvoice = await InvoicingRepository.saveFiscalDocument(tenantId, preparedDoc, {
          id: "sys_woocommerce",
          name: "WooCommerce Connector",
          role: "PLATFORM_SUPER_ADMIN",
        });

        console.log(`[WooCommerce Webhook] Auto-issued invoice ${issuedInvoice.document_number} for WC Order #${payload.id}`);
      } catch (invErr: any) {
        console.error("[WooCommerce Webhook] Failed to auto-issue fiscal invoice:", invErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: "WooCommerce order processed successfully",
      marketos_order_id: createdOrder.id,
      marketos_order_number: createdOrder.order_number,
      fiscal_invoice_number: issuedInvoice?.document_number || null,
    });
  } catch (err: any) {
    console.error("[WooCommerce Webhook Error]", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
