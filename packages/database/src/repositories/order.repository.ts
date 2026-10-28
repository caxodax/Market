import type {
  Order,
  OrderItem,
  PaymentProof,
  PaymentMethodType,
  PaymentStatus,
  OrderStatus,
  CustomerAccountSummary,
  SalesAnalytics,
  SelectedModifier,
  DeliveryType,
  AuditActor,
  AuditActionType,
  CurrencyCode,
  Customer,
} from "@marketos/types";
import { extractGpsCoordinates } from "@marketos/types";
import { state } from "../mock-data.ts";
import {
  convertUsdToVes,
  getCaracasDateKey,
  getCaracasRangeBounds,
  sanitizeSafeUrl,
} from "@marketos/utils";
import { getSupabase, generateUuid, isUuid, isLiveDatabaseConfigured } from "./base.ts";
import { AuditRepository } from "./audit.repository.ts";
import { ExchangeRateRepository } from "./exchange-rate.repository.ts";
import { TenantRepository } from "./tenant.repository.ts";
import { CatalogRepository } from "./catalog.repository.ts";
import { FoodServiceRepository } from "./food-service.repository.ts";
import { CouponRepository } from "./coupon.repository.ts";

export interface CreateOrderInput {
  tenantId: string;
  storeId: string;
  customerName: string;
  customerPhone: string;
  customerIdNumber?: string;
  customerEmail?: string;
  deliveryType: DeliveryType;
  deliveryZoneId?: string;
  deliveryAddress?: string;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  deliveryFeeUsd?: number;
  couponCode?: string;
  discountUsd?: number;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitPriceUsd: number;
    selected_modifiers?: SelectedModifier[];
    is_tax_exempt?: boolean;
  }[];
  notes?: string;
  cashTenderedUsd?: number;
  changeRequiredUsd?: number;
  idempotencyKey?: string;
}

export interface SubmitPaymentInput {
  tenantId: string;
  orderId: string;
  method: PaymentMethodType;
  bankName?: string;
  referenceNumber: string;
  amount: number;
  currency?: "VES" | "USD";
  proofImageUrl?: string;
}

export class OrderRepository {

/**
   * Create an Order with Multi-Tenant isolation and Phase 2 Operational features
   */
  static async createOrder(input: CreateOrderInput): Promise<Order> {
    const activeModules = await TenantRepository.getTenantActiveModuleIds(input.tenantId);
    const isVenezuelaActive = activeModules.includes("local_venezuela");
    const rate = isVenezuelaActive ? await ExchangeRateRepository.getExchangeRate(input.tenantId) : { value: 1 };
    
    // Ensure valid store UUID
    let validStoreId = input.storeId;
    if (!isUuid(validStoreId)) {
      const stores = await CatalogRepository.getStores(input.tenantId);
      validStoreId = stores[0]?.id || "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d";
    }

    const supabase = getSupabase();

    // 1. Ponytail Security Guard: Validate authentic product prices and verify stock before placing order
    const validatedItems: (CreateOrderInput["items"][number] & { is_tax_exempt?: boolean })[] =
      input.items.map((it) => ({ ...it, is_tax_exempt: it.is_tax_exempt }));

    if (supabase) {
      const productIds = input.items
        .map((it) => it.productId)
        .filter((id) => isUuid(id));

      if (productIds.length > 0) {
        const { data: dbProducts } = await supabase
          .from("products")
          .select("id, name, price_usd, is_active, is_tax_exempt, inventory(quantity, store_id)")
          .eq("tenant_id", input.tenantId)
          .in("id", productIds);

        if (dbProducts && dbProducts.length > 0) {
          const productMap = new Map(dbProducts.map((p: any) => [p.id, p]));

          for (const item of validatedItems) {
            const dbProd: any = productMap.get(item.productId);
            if (dbProd) {
              if (!dbProd.is_active) {
                throw new Error(`El producto "${dbProd.name}" no está disponible actualmente.`);
              }

              // Overwrite with authentic server price and fiscal status from database
              const basePrice = Number(dbProd.price_usd);
              const modifiersDelta = item.selected_modifiers?.reduce((sum, m) => sum + (m.price_usd || 0), 0) || 0;
              item.unitPriceUsd = Number((basePrice + modifiersDelta).toFixed(2));
              item.is_tax_exempt = Boolean(dbProd.is_tax_exempt);

              // Pre-order stock verification with resilient inventory row fallback
              const invForStore = Array.isArray(dbProd.inventory)
                ? dbProd.inventory.find((inv: any) => inv.store_id === validStoreId)
                : null;
              const memProdMatch = state.products.find(
                (p) => p.id === dbProd.id || p.name === dbProd.name
              );
              const fallbackStock = memProdMatch?.stock !== undefined ? memProdMatch.stock : 20;
              const currentStock =
                invForStore?.quantity !== undefined && invForStore?.quantity !== null
                  ? Number(invForStore.quantity)
                  : fallbackStock;

              if (currentStock < item.quantity) {
                throw new Error(
                  `Stock insuficiente para "${dbProd.name}". Disponibles: ${currentStock}, solicitados: ${item.quantity}.`
                );
              }
            }
          }
        }
      }
    }

    // 2. Calculate items subtotal with authentic server prices
    const subtotalUsd = validatedItems.reduce(
      (acc, item) => acc + item.unitPriceUsd * item.quantity,
      0
    );

    // 3. AgentShield: Validate and strictly calculate coupon discount on server
    let discountUsd = 0;
    let couponId: string | null = null;
    if (input.couponCode) {
      const couponRes = await CouponRepository.validateCoupon(
        input.tenantId,
        input.couponCode,
        subtotalUsd,
        input.customerPhone
      );
      if (!couponRes.valid) {
        throw new Error(
          `Cupón de descuento no válido: ${couponRes.message || "El cupón ha expirado o no cumple los requisitos."}`
        );
      }
      discountUsd = couponRes.discountUsd;
      couponId = couponRes.coupon?.id || null;
    } else {
      // Reject arbitrary client-supplied discounts to prevent price tampering
      discountUsd = 0;
    }

    // 4. Validate delivery fee against database delivery_zones
    let deliveryFeeUsd = 0;
    let validDeliveryZoneId: string | null = null;

    if (input.deliveryType === "DELIVERY") {
      if (input.deliveryZoneId && isUuid(input.deliveryZoneId) && supabase) {
        const { data: zone } = await supabase
          .from("delivery_zones")
          .select("id, price_usd, is_active")
          .eq("tenant_id", input.tenantId)
          .eq("id", input.deliveryZoneId)
          .maybeSingle();

        if (zone && zone.is_active) {
          validDeliveryZoneId = zone.id;
          deliveryFeeUsd = Number(zone.price_usd);
        } else {
          deliveryFeeUsd = input.deliveryFeeUsd || 0;
        }
      } else {
        deliveryFeeUsd = input.deliveryFeeUsd || 0;
      }
    }

    // 5. Compute final totals and fiscal breakdown (Art. 18 Ley del IVA)
    const finalTotalUsd = Number(
      Math.max(0, subtotalUsd - discountUsd + deliveryFeeUsd).toFixed(2)
    );
    const totalVes = isVenezuelaActive ? convertUsdToVes(finalTotalUsd, rate.value) : 0;
    const exchangeRateApplied = isVenezuelaActive ? rate.value : 1;
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;

    // Calculate exempt vs taxable portions
    let rawExemptUsd = 0;
    let rawTaxableUsd = 0;
    for (const item of validatedItems) {
      if (!item.is_tax_exempt && typeof item.productId === "string") {
        const memProd = state.products.find((p) => p.id === item.productId);
        if (memProd?.is_tax_exempt) {
          item.is_tax_exempt = true;
        }
      }
      const lineTotal = item.unitPriceUsd * item.quantity;
      if (item.is_tax_exempt) {
        rawExemptUsd += lineTotal;
      } else {
        rawTaxableUsd += lineTotal;
      }
    }

    let subtotalExemptUsd = rawExemptUsd;
    let subtotalTaxableUsd = rawTaxableUsd;
    if (discountUsd > 0 && subtotalUsd > 0) {
      const exemptRatio = rawExemptUsd / subtotalUsd;
      subtotalExemptUsd = Math.max(0, rawExemptUsd - discountUsd * exemptRatio);
      subtotalTaxableUsd = Math.max(0, rawTaxableUsd - discountUsd * (1 - exemptRatio));
    }
    const tenantSettings = await TenantRepository.getTenantSettings(input.tenantId);
    const isDeliveryFacturado =
      tenantSettings.operational_settings?.delivery_billing_mode !== "THIRD_PARTY" &&
      tenantSettings.billing_settings?.delivery_billing_mode !== "THIRD_PARTY";

    if (deliveryFeeUsd > 0 && isDeliveryFacturado) {
      subtotalTaxableUsd += deliveryFeeUsd;
    }
    subtotalExemptUsd = Number(subtotalExemptUsd.toFixed(2));
    subtotalTaxableUsd = Number(subtotalTaxableUsd.toFixed(2));

    const ivaRate = 0.16;
    const ivaAmountUsd = Number((subtotalTaxableUsd * ivaRate).toFixed(2));
    const ivaAmountVes = Number((ivaAmountUsd * exchangeRateApplied).toFixed(2));

    const validCouponId = isUuid(couponId) ? couponId : null;

    let customerId = generateUuid();
    const earnedPoints = Math.floor(finalTotalUsd);

    // 5. Look up or register customer in Supabase / State with loyalty points
    if (supabase) {
      try {
        const cleanPhone = input.customerPhone.replace(/\D/g, "");
        let existingCustomer: any = null;

        // Try exact match first
        const { data: exactCust } = await supabase
          .from("customers")
          .select("id, loyalty_points")
          .eq("tenant_id", input.tenantId)
          .eq("phone", input.customerPhone)
          .maybeSingle();

        existingCustomer = exactCust;

        // Fallback to last 7-10 digits for Venezuela numbers (e.g. 04128505629 vs 584128505629)
        if (!existingCustomer && cleanPhone.length >= 7) {
          const { data: fuzzyCust } = await supabase
            .from("customers")
            .select("id, loyalty_points")
            .eq("tenant_id", input.tenantId)
            .ilike("phone", `%${cleanPhone.slice(-7)}%`)
            .maybeSingle();

          existingCustomer = fuzzyCust;
        }

        if (existingCustomer && isUuid(existingCustomer.id)) {
          customerId = existingCustomer.id;
          await supabase
            .from("customers")
            .update({
              loyalty_points: (existingCustomer.loyalty_points || 0) + earnedPoints,
              name: input.customerName,
              email: input.customerEmail || null,
              phone: input.customerPhone,
              id_number: input.customerIdNumber || existingCustomer.id_number || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", customerId);
        } else {
          const { data: newCust, error: custErr } = await supabase
            .from("customers")
            .insert({
              tenant_id: input.tenantId,
              name: input.customerName,
              phone: input.customerPhone,
              id_number: input.customerIdNumber || null,
              email: input.customerEmail || null,
              loyalty_points: earnedPoints,
              is_guest: true,
            })
            .select("id")
            .single();

          if (newCust && isUuid(newCust.id)) {
            customerId = newCust.id;
          } else if (custErr) {
            console.warn("[MarketOS] Error registering customer in Supabase:", custErr);
          }
        }

        // Deduplication / Idempotency protection:
        // Check if identical order was already placed by this customer within the last 8 seconds
        const eightSecondsAgo = new Date(Date.now() - 8000).toISOString();
        const { data: recentOrder } = await supabase
          .from("orders")
          .select("id, order_number, total_usd, status, created_at")
          .eq("tenant_id", input.tenantId)
          .eq("customer_id", customerId)
          .gte("created_at", eightSecondsAgo)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (recentOrder && Math.abs(Number(recentOrder.total_usd) - finalTotalUsd) < 0.01) {
          console.warn("[MarketOS] Duplicate order attempt blocked by database threshold check:", recentOrder.id);
          const allOrders = await this.getTenantOrders(input.tenantId);
          const matched = allOrders.find((o) => o.id === recentOrder.id);
          if (matched) return matched;
        }
      } catch (e) {
        console.warn("[MarketOS] Customer persistence warning:", e);
      }
    }

    // Always mirror customer in in-memory state for fallback
    const memIdx = state.customers.findIndex(
      (c) =>
        c.tenant_id === input.tenantId &&
        (c.phone === input.customerPhone ||
          (c.phone.replace(/\D/g, "") === input.customerPhone.replace(/\D/g, "") &&
            input.customerPhone.replace(/\D/g, "").length >= 7))
    );
    if (memIdx !== -1) {
      state.customers[memIdx].name = input.customerName;
      if (input.customerIdNumber) {
        state.customers[memIdx].id_number = input.customerIdNumber;
      }
      state.customers[memIdx].loyalty_points =
        (state.customers[memIdx].loyalty_points || 0) + earnedPoints;
    } else {
      state.customers.push({
        id: customerId,
        tenant_id: input.tenantId,
        auth_user_id: null,
        name: input.customerName,
        phone: input.customerPhone,
        id_number: input.customerIdNumber || null,
        email: input.customerEmail || null,
        loyalty_points: earnedPoints,
        is_guest: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // In-memory fallback deduplication
    const memRecentOrder = state.orders.find(
      (o) =>
        o.tenant_id === input.tenantId &&
        o.customer_id === customerId &&
        Math.abs(o.total_usd - finalTotalUsd) < 0.01 &&
        Date.now() - new Date(o.created_at).getTime() < 8000
    );
    if (memRecentOrder) {
      console.warn("[MarketOS State] Duplicate order attempt blocked by in-memory check:", memRecentOrder.id);
      return memRecentOrder;
    }

    // Format delivery address with optional precise GPS tag
    let formattedDeliveryAddress = input.deliveryAddress?.trim() || null;
    const hasGpsCoords =
      typeof input.deliveryLatitude === "number" &&
      typeof input.deliveryLongitude === "number";

    if (hasGpsCoords) {
      const gpsTag = `[GPS: ${input.deliveryLatitude!.toFixed(6)},${input.deliveryLongitude!.toFixed(6)}]`;
      if (!formattedDeliveryAddress) {
        formattedDeliveryAddress = gpsTag;
      } else if (!formattedDeliveryAddress.includes("[GPS:")) {
        formattedDeliveryAddress = `${formattedDeliveryAddress} ${gpsTag}`;
      }
    }

    // Build cash notes if applicable
    const extraCashNotes: string[] = [];
    if (input.cashTenderedUsd) {
      extraCashNotes.push(`Paga con: $${input.cashTenderedUsd.toFixed(2)}`);
    }
    if (input.changeRequiredUsd) {
      extraCashNotes.push(`Vuelto: $${input.changeRequiredUsd.toFixed(2)}`);
    }
    const combinedNotes = [input.notes, ...extraCashNotes].filter(Boolean).join(" | ") || null;

    const newOrder: Order = {
      id: generateUuid(),
      tenant_id: input.tenantId,
      store_id: validStoreId,
      customer_id: customerId,
      order_number: orderNumber,
      status: "PAYMENT_PENDING",
      delivery_type: input.deliveryType,
      delivery_zone_id: validDeliveryZoneId,
      delivery_address: formattedDeliveryAddress,
      delivery_latitude: input.deliveryLatitude ?? null,
      delivery_longitude: input.deliveryLongitude ?? null,
      delivery_maps_url: hasGpsCoords
        ? `https://www.google.com/maps?q=${input.deliveryLatitude},${input.deliveryLongitude}`
        : null,
      delivery_fee_usd: deliveryFeeUsd,
      coupon_id: validCouponId,
      discount_usd: discountUsd,
      total_usd: finalTotalUsd,
      total_ves: totalVes,
      exchange_rate_applied: exchangeRateApplied,
      subtotal_exempt_usd: subtotalExemptUsd,
      subtotal_taxable_usd: subtotalTaxableUsd,
      iva_amount_usd: ivaAmountUsd,
      iva_amount_ves: ivaAmountVes,
      notes: combinedNotes,
      cash_tendered_usd: input.cashTenderedUsd ?? null,
      change_required_usd: input.changeRequiredUsd ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      customer_id_number: input.customerIdNumber || null,
      customer_email: input.customerEmail || null,
      items: validatedItems.map((it, idx) => ({
        id: `item-${Date.now()}-${idx}`,
        order_id: `ord-${Date.now()}`,
        tenant_id: input.tenantId,
        product_id: it.productId,
        product_name: it.productName,
        quantity: it.quantity,
        unit_price_usd: it.unitPriceUsd,
        total_price_usd: Number((it.quantity * it.unitPriceUsd).toFixed(2)),
        is_tax_exempt: Boolean(it.is_tax_exempt),
        selected_modifiers: it.selected_modifiers,
      })),
    };

    // 6. Insert Order into Supabase
    if (supabase) {
      try {
        // Strictly safe columns matching Supabase orders table schema
        const orderInsertPayload: any = {
          tenant_id: newOrder.tenant_id,
          store_id: validStoreId,
          customer_id: customerId,
          customer_id_number: newOrder.customer_id_number,
          order_number: newOrder.order_number,
          status: newOrder.status,
          delivery_type: newOrder.delivery_type,
          delivery_zone_id: validDeliveryZoneId,
          delivery_address: newOrder.delivery_address,
          delivery_fee_usd: newOrder.delivery_fee_usd,
          coupon_id: validCouponId,
          discount_usd: newOrder.discount_usd,
          total_usd: newOrder.total_usd,
          total_ves: newOrder.total_ves,
          exchange_rate_applied: newOrder.exchange_rate_applied,
          notes: combinedNotes || null,
        };

        let { data: insertedOrder, error: orderInsertErr } = await supabase
          .from("orders")
          .insert(orderInsertPayload)
          .select("id")
          .single();

        if (orderInsertErr) {
          console.error("[MarketOS] Primary order insert failed, attempting safe fallback:", orderInsertErr);
          // Retry without optional foreign key columns (delivery_zone_id, coupon_id) in case of constraint mismatch
          const safeRetryPayload = {
            tenant_id: newOrder.tenant_id,
            store_id: validStoreId,
            customer_id: customerId,
            order_number: newOrder.order_number,
            status: newOrder.status,
            delivery_type: newOrder.delivery_type,
            delivery_address: newOrder.delivery_address,
            total_usd: newOrder.total_usd,
            total_ves: newOrder.total_ves,
            exchange_rate_applied: newOrder.exchange_rate_applied,
            notes: combinedNotes || null,
          };
          const retryRes = await supabase
            .from("orders")
            .insert(safeRetryPayload)
            .select("id")
            .single();

          if (!retryRes.error && retryRes.data) {
            insertedOrder = retryRes.data;
            orderInsertErr = null;
          } else {
            console.error("[MarketOS] Critical: Safe retry also failed:", retryRes.error);
          }
        }

        if (insertedOrder && isUuid(insertedOrder.id)) {
          newOrder.id = insertedOrder.id;
          newOrder.notes = combinedNotes || null;

          // Fetch fallback product id for tenant to ensure NOT NULL constraint on order_items.product_id
          let fallbackProductId: string | null = null;
          const { data: tenantProds } = await supabase
            .from("products")
            .select("id")
            .eq("tenant_id", input.tenantId)
            .eq("is_active", true)
            .limit(1);
          if (tenantProds && tenantProds.length > 0 && isUuid(tenantProds[0].id)) {
            fallbackProductId = tenantProds[0].id;
          }

          // Build order_items strictly matching Supabase schema (no selected_modifiers column)
          const itemsPayload: any[] = [];
          for (const it of validatedItems) {
            let targetProductId = isUuid(it.productId) ? it.productId : null;
            if (!targetProductId) {
              const { data: p } = await supabase
                .from("products")
                .select("id")
                .eq("tenant_id", input.tenantId)
                .ilike("name", it.productName)
                .maybeSingle();
              if (p && isUuid(p.id)) {
                targetProductId = p.id;
              } else {
                targetProductId = fallbackProductId;
              }
            }

            const modText = it.selected_modifiers && it.selected_modifiers.length > 0
              ? ` (${it.selected_modifiers.map((m: any) => m.name).join(", ")})`
              : "";

            itemsPayload.push({
              tenant_id: input.tenantId,
              order_id: insertedOrder.id,
              product_id: targetProductId,
              product_name: `${it.productName}${modText}`.slice(0, 255),
              quantity: it.quantity,
              unit_price_usd: it.unitPriceUsd,
              total_price_usd: Number((it.quantity * it.unitPriceUsd).toFixed(2)),
            });
          }

          const { error: itemsInsertErr } = await supabase.from("order_items").insert(itemsPayload);
          if (itemsInsertErr) {
            console.error("[MarketOS] Error inserting order_items in Supabase:", itemsInsertErr);
          }

          // Decrement inventory stock & record inventory movements in Supabase
          for (const it of validatedItems) {
            const targetProductId = isUuid(it.productId)
              ? it.productId
              : itemsPayload.find((p) => p.product_name.startsWith(it.productName))?.product_id;

            if (targetProductId) {
              let { data: inv } = await supabase
                .from("inventory")
                .select("id, quantity, store_id")
                .eq("store_id", validStoreId)
                .eq("product_id", targetProductId)
                .maybeSingle();

              if (!inv) {
                const { data: fallbackInv } = await supabase
                  .from("inventory")
                  .select("id, quantity, store_id")
                  .eq("tenant_id", input.tenantId)
                  .eq("product_id", targetProductId)
                  .limit(1)
                  .maybeSingle();
                if (fallbackInv) {
                  inv = fallbackInv;
                }
              }

              const targetStoreId = inv?.store_id || validStoreId;

              if (inv) {
                const newQty = Math.max(0, inv.quantity - it.quantity);
                await supabase
                  .from("inventory")
                  .update({ quantity: newQty, updated_at: new Date().toISOString() })
                  .eq("id", inv.id);

                await supabase.from("inventory_movements").insert({
                  tenant_id: input.tenantId,
                  store_id: targetStoreId,
                  product_id: targetProductId,
                  quantity_change: -it.quantity,
                  previous_quantity: inv.quantity,
                  new_quantity: newQty,
                  reason: "SALE",
                });

                await AuditRepository.recordAuditLog({
                  tenantId: input.tenantId,
                  action: "STOCK_ADJUSTED",
                  entity: "inventory",
                  entityId: targetProductId,
                  actorName: "Venta en Línea",
                  actorRole: "SYSTEM",
                  oldData: {
                    product_id: targetProductId,
                    name: it.productName,
                    stock_quantity: inv.quantity,
                  },
                  newData: {
                    product_id: targetProductId,
                    name: it.productName,
                    delta: -it.quantity,
                    quantity: newQty,
                    reason: "VENTA",
                    note: `Deducción por venta #${newOrder.order_number}`,
                  },
                });
              } else {
                // Upsert resilient inventory row if not yet initialized for this store
                const memProdMatch = state.products.find(
                  (p) => p.id === targetProductId || p.name === it.productName
                );
                const initialStock = memProdMatch?.stock !== undefined ? memProdMatch.stock : 20;
                const newQty = Math.max(0, initialStock - it.quantity);

                await supabase
                  .from("inventory")
                  .upsert(
                    {
                      tenant_id: input.tenantId,
                      store_id: validStoreId,
                      product_id: targetProductId,
                      quantity: newQty,
                      min_quantity: 5,
                      updated_at: new Date().toISOString(),
                    },
                    { onConflict: "store_id, product_id" }
                  );

                await supabase.from("inventory_movements").insert({
                  tenant_id: input.tenantId,
                  store_id: validStoreId,
                  product_id: targetProductId,
                  quantity_change: -it.quantity,
                  previous_quantity: initialStock,
                  new_quantity: newQty,
                  reason: "SALE",
                });

                await AuditRepository.recordAuditLog({
                  tenantId: input.tenantId,
                  action: "STOCK_ADJUSTED",
                  entity: "inventory",
                  entityId: targetProductId,
                  actorName: "Venta en Línea",
                  actorRole: "SYSTEM",
                  oldData: {
                    product_id: targetProductId,
                    name: it.productName,
                    stock_quantity: initialStock,
                  },
                  newData: {
                    product_id: targetProductId,
                    name: it.productName,
                    delta: -it.quantity,
                    quantity: newQty,
                    reason: "VENTA",
                    note: `Deducción por venta #${newOrder.order_number}`,
                  },
                });
              }
            }
          }
        } else if (orderInsertErr) {
          throw new Error(`No se pudo persistir la orden en el servidor: ${orderInsertErr.message}`);
        }
      } catch (e: any) {
        if (e.message && e.message.includes("No se pudo persistir")) {
          throw e;
        }
        console.warn("[Supabase] Insert order fallback warning:", e);
      }
    }

    state.orders.unshift(newOrder);

    // Increment coupon usage count if a valid coupon was applied
    if (validCouponId) {
      if (supabase) {
        try {
          const { data: coupRow } = await supabase
            .from("coupons")
            .select("usage_count")
            .eq("id", validCouponId)
            .maybeSingle();
          if (coupRow) {
            await supabase
              .from("coupons")
              .update({ usage_count: (Number(coupRow.usage_count) || 0) + 1 })
              .eq("id", validCouponId);
          }
        } catch (e) {
          console.warn("[MarketOS] Coupon usage increment warning in Supabase:", e);
        }
      }
      const memCoup = state.coupons.find((c) => c.id === validCouponId);
      if (memCoup) {
        memCoup.usage_count = (memCoup.usage_count || 0) + 1;
      }
    }

    // Decrement stock in memory state
    for (const item of input.items) {
      const prod = state.products.find((p) => p.id === item.productId || p.name === item.productName);
      if (prod && prod.stock >= item.quantity) {
        prod.stock -= item.quantity;
      }
    }

    // Record audit log for new order
    await AuditRepository.recordAuditLog({
      tenantId: input.tenantId,
      action: "ORDER_CREATED",
      entity: "orders",
      entityId: newOrder.id,
      newData: {
        order_number: newOrder.order_number,
        total_usd: newOrder.total_usd,
        total_ves: newOrder.total_ves,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
      },
    });

    return newOrder;
  }

/**
   * Submit Payment Proof for an Order
   */
  static async submitPaymentProof(
    input: SubmitPaymentInput
  ): Promise<PaymentProof> {
    const payment: PaymentProof = {
      id: generateUuid(),
      order_id: input.orderId,
      tenant_id: input.tenantId,
      method: input.method,
      bank_name: input.bankName || "Comprobante de Pago",
      reference_number: input.referenceNumber,
      amount: input.amount,
      currency: input.currency || "USD",
      payment_date: new Date().toISOString().split("T")[0],
      proof_image_url: sanitizeSafeUrl(input.proofImageUrl),
      status: "PENDING",
      created_at: new Date().toISOString(),
    };

    const supabase = getSupabase();
    if (supabase && isUuid(input.orderId)) {
      try {
        const { error: payInsertErr } = await supabase.from("payments").insert({
          tenant_id: payment.tenant_id,
          order_id: payment.order_id,
          method: payment.method,
          bank_name: payment.bank_name,
          reference_number: payment.reference_number,
          amount: payment.amount,
          currency: payment.currency,
          payment_date: payment.payment_date,
          proof_image_url: payment.proof_image_url,
          status: payment.status,
        });

        if (payInsertErr) {
          console.error("[MarketOS] Error inserting payment proof in Supabase:", payInsertErr);
        }
      } catch (e) {
        console.warn("[MarketOS] submitPaymentProof Supabase fallback:", e);
      }
    }

    state.payments.unshift(payment);

    // Sync proof and payment info to memory order
    const memOrder = state.orders.find((o) => o.id === input.orderId);
    if (memOrder) {
      memOrder.payment_method = input.method;
      memOrder.payment_reference = input.referenceNumber;
      memOrder.payment_status = "PENDING";
      memOrder.proof_image_url = input.proofImageUrl || null;
    }

    await AuditRepository.recordAuditLog({
      tenantId: input.tenantId,
      action: "PAYMENT_PROOF_SUBMITTED",
      entity: "payments",
      entityId: payment.id,
      newData: {
        orderId: input.orderId,
        method: input.method,
        referenceNumber: input.referenceNumber,
        amount: input.amount,
        currency: input.currency || "USD",
      },
    });

    return payment;
  }

/**
   * Get Orders for Tenant Admin with full enrichment (items, customer, payment details)
   */
  static async getTenantOrders(tenantId: string, limit?: number, offset?: number): Promise<Order[]> {
    const resolvedTenant = await TenantRepository.getTenant(tenantId);
    const actualTenantId = resolvedTenant?.id || tenantId;

    const supabase = getSupabase();
    if (supabase) {
      try {
        let query = supabase
          .from("orders")
          .select("*")
          .or(`tenant_id.eq.${actualTenantId},tenant_id.eq.${tenantId}`)
          .order("created_at", { ascending: false });

        if (limit && limit > 0) {
          if (offset && offset > 0) {
            query = query.range(offset, offset + limit - 1);
          } else {
            query = query.limit(limit);
          }
        }

        const { data: rawOrders, error } = await query;

        if (!error && rawOrders) {
          if (rawOrders.length === 0) {
            return [];
          }
          const orderIds = rawOrders.map((o: any) => o.id);
          const customerIds = Array.from(
            new Set(rawOrders.map((o: any) => o.customer_id).filter(Boolean))
          );
          const storeIds = Array.from(
            new Set(rawOrders.map((o: any) => o.store_id).filter(Boolean))
          );

          const [itemsRes, custRes, payRes, storesRes] = await Promise.all([
            supabase.from("order_items").select("*").in("order_id", orderIds),
            customerIds.length > 0
              ? supabase.from("customers").select("id, name, phone, email, id_number").in("id", customerIds)
              : Promise.resolve({ data: [] }),
            supabase.from("payments").select("*").in("order_id", orderIds),
            storeIds.length > 0
              ? supabase.from("stores").select("id, name").in("id", storeIds)
              : Promise.resolve({ data: [] }),
          ]);

          const itemsMap = new Map<string, OrderItem[]>();
          ((itemsRes as any)?.data || []).forEach((item: OrderItem) => {
            const list = itemsMap.get(item.order_id) || [];
            list.push(item);
            itemsMap.set(item.order_id, list);
          });

          const custMap = new Map<string, any>();
          ((custRes as any)?.data || []).forEach((c: any) => custMap.set(c.id, c));

          const payMap = new Map<string, any>();
          ((payRes as any)?.data || []).forEach((p: any) => payMap.set(p.order_id, p));

          const storeMap = new Map<string, string>();
          ((storesRes as any)?.data || []).forEach((s: any) => storeMap.set(s.id, s.name));

          return rawOrders.map((o: any) => {
            const cust = custMap.get(o.customer_id);
            const pay = payMap.get(o.id);
            const storeName = storeMap.get(o.store_id);

            // Parse cash & change from notes if not present directly
            const cashMatch = o.notes ? o.notes.match(/Paga con:\s*\$([0-9.]+)/) : null;
            const changeMatch = o.notes ? o.notes.match(/Vuelto:\s*\$([0-9.]+)/) : null;
            const parsedCash = cashMatch ? parseFloat(cashMatch[1]) : (o.cash_tendered_usd ?? null);
            const parsedChange = changeMatch ? parseFloat(changeMatch[1]) : (o.change_required_usd ?? null);

            // Parse GPS coordinates from delivery_address
            const gpsInfo = extractGpsCoordinates(o.delivery_address);
            const deliveryLat = gpsInfo.lat ?? o.delivery_latitude ?? null;
            const deliveryLng = gpsInfo.lng ?? o.delivery_longitude ?? null;
            const deliveryMapsUrl = gpsInfo.mapsUrl || (deliveryLat && deliveryLng ? `https://www.google.com/maps?q=${deliveryLat},${deliveryLng}` : null);

            return {
              ...o,
              items: itemsMap.get(o.id) || [],
              customer_name: cust?.name || o.customer_name,
              customer_phone: cust?.phone || o.customer_phone,
              customer_id_number: cust?.id_number || o.customer_id_number || null,
              customer_email: cust?.email || o.customer_email,
              payment_method: pay?.method || o.payment_method,
              payment_reference: pay?.reference_number || o.payment_reference,
              payment_status: pay?.status || o.payment_status,
              proof_image_url: pay?.proof_image_url || o.proof_image_url || null,
              store_name: storeName,
              cash_tendered_usd: parsedCash,
              change_required_usd: parsedChange,
              delivery_latitude: deliveryLat,
              delivery_longitude: deliveryLng,
              delivery_maps_url: deliveryMapsUrl,
            } as Order;
          });
        }
      } catch (err) {
        console.warn("[MarketOS] getTenantOrders Supabase error:", err);
      }
    }

    // In-memory fallback enriched with payments and stores
    if (isLiveDatabaseConfigured()) return [];
    const filtered = state.orders
      .filter((o) => o.tenant_id === actualTenantId || o.tenant_id === tenantId)
      .map((o) => {
        const pay = state.payments.find((p) => p.order_id === o.id);
        const cust = state.customers.find((c) => c.id === o.customer_id);
        const st = state.stores.find((s) => s.id === o.store_id);
        const gpsInfo = extractGpsCoordinates(o.delivery_address);
        const deliveryLat = gpsInfo.lat ?? o.delivery_latitude ?? null;
        const deliveryLng = gpsInfo.lng ?? o.delivery_longitude ?? null;
        const deliveryMapsUrl = gpsInfo.mapsUrl || (deliveryLat && deliveryLng ? `https://www.google.com/maps?q=${deliveryLat},${deliveryLng}` : null);

        return {
          ...o,
          customer_name: cust?.name || o.customer_name,
          customer_phone: cust?.phone || o.customer_phone,
          customer_id_number: cust?.id_number || o.customer_id_number || null,
          customer_email: cust?.email || o.customer_email,
          payment_method: pay?.method || o.payment_method,
          payment_reference: pay?.reference_number || o.payment_reference,
          payment_status: pay?.status || o.payment_status,
          proof_image_url: pay?.proof_image_url || o.proof_image_url || null,
          store_name: st?.name || o.store_name,
          delivery_latitude: deliveryLat,
          delivery_longitude: deliveryLng,
          delivery_maps_url: deliveryMapsUrl,
        };
      });

    const start = offset && offset > 0 ? offset : 0;
    return limit && limit > 0 ? filtered.slice(start, start + limit) : (start > 0 ? filtered.slice(start) : filtered);
  }

/**
   * Get Sales and Financial Analytics for Store Owner
   */
  static async getSalesAnalytics(
    tenantId: string,
    filter?: { dateRange?: "today" | "week" | "month" | "all"; storeId?: string }
  ): Promise<SalesAnalytics> {
    const orders = await this.getTenantOrders(tenantId);

    const range = filter?.dateRange || "all";
    const { startUtc, endUtc } = getCaracasRangeBounds(range);

    const filteredOrders = orders.filter((o) => {
      if (filter?.storeId && o.store_id !== filter.storeId) return false;
      if (startUtc) {
        const orderDate = new Date(o.created_at);
        if (orderDate < startUtc || orderDate > endUtc) return false;
      }
      return true;
    });

    let totalRevenueUsd = 0;
    let totalRevenueVes = 0;
    let completedOrdersCount = 0;
    let pendingOrdersCount = 0;
    let cancelledOrdersCount = 0;
    let itemsSoldTotal = 0;

    const methodStatsMap = new Map<PaymentMethodType, { totalUsd: number; totalVes: number; count: number }>();
    const statusStatsMap = new Map<OrderStatus, { totalUsd: number; count: number }>();
    const productStatsMap = new Map<string, { name: string; quantity: number; revenueUsd: number }>();
    const dailyMap = new Map<string, { totalUsd: number; count: number }>();

    for (const order of filteredOrders) {
      const isPaidOrCompleted = ["PAYMENT_APPROVED", "PREPARING", "READY", "DELIVERING", "COMPLETED"].includes(order.status);

      if (order.status === "COMPLETED") completedOrdersCount++;
      else if (order.status === "CANCELLED") cancelledOrdersCount++;
      else pendingOrdersCount++;

      if (isPaidOrCompleted) {
        totalRevenueUsd += order.total_usd;
        totalRevenueVes += order.total_ves;
      }

      // Status breakdown
      const st = statusStatsMap.get(order.status) || { totalUsd: 0, count: 0 };
      st.totalUsd += order.total_usd;
      st.count += 1;
      statusStatsMap.set(order.status, st);

      // Payment method breakdown
      if (order.payment_method) {
        const m = methodStatsMap.get(order.payment_method) || { totalUsd: 0, totalVes: 0, count: 0 };
        m.totalUsd += order.total_usd;
        m.totalVes += order.total_ves;
        m.count += 1;
        methodStatsMap.set(order.payment_method, m);
      }

      // Products breakdown
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          if (isPaidOrCompleted) {
            itemsSoldTotal += item.quantity;
          }
          const p = productStatsMap.get(item.product_id) || { name: item.product_name, quantity: 0, revenueUsd: 0 };
          p.quantity += item.quantity;
          p.revenueUsd += item.total_price_usd;
          productStatsMap.set(item.product_id, p);
        }
      }

      // Daily breakdown (normalized to America/Caracas timezone)
      const dayKey = getCaracasDateKey(order.created_at) || order.created_at.split("T")[0];
      const d = dailyMap.get(dayKey) || { totalUsd: 0, count: 0 };
      if (isPaidOrCompleted) {
        d.totalUsd += order.total_usd;
      }
      d.count += 1;
      dailyMap.set(dayKey, d);
    }

    const totalOrdersCount = filteredOrders.length;
    const averageTicketUsd =
      completedOrdersCount > 0
        ? Number((totalRevenueUsd / completedOrdersCount).toFixed(2))
        : totalOrdersCount > 0
        ? Number((totalRevenueUsd / totalOrdersCount).toFixed(2))
        : 0;

    const METHOD_LABELS: Record<PaymentMethodType, string> = {
      PAGO_MOVIL: "Pago Móvil (VES)",
      BANK_TRANSFER: "Transferencia Bancaria",
      ZELLE: "Zelle (USD)",
      CASH_USD: "Efectivo Dólares ($)",
      CASH_VES: "Efectivo Bolívares (Bs)",
      POS: "Punto de Venta / Tarjeta",
      BINANCE: "Binance Pay / USDT",
      BINANCE_PAY: "Binance Pay / USDT",
    };

    const STATUS_LABELS: Record<OrderStatus, string> = {
      CREATED: "Iniciado",
      PAYMENT_PENDING: "Por Verificar Pago",
      PAYMENT_APPROVED: "Pago Aprobado",
      PREPARING: "En Preparación",
      READY: "Listo para Despacho",
      DELIVERING: "En Ruta",
      COMPLETED: "Completado y Entregado",
      CANCELLED: "Cancelado / Rechazado",
    };

    const revenueByMethod = Array.from(methodStatsMap.entries())
      .map(([method, val]) => ({
        method,
        label: METHOD_LABELS[method] || method,
        totalUsd: Number(val.totalUsd.toFixed(2)),
        totalVes: Number(val.totalVes.toFixed(2)),
        count: val.count,
      }))
      .sort((a, b) => b.totalUsd - a.totalUsd);

    const revenueByStatus = Array.from(statusStatsMap.entries()).map(([status, val]) => ({
      status,
      label: STATUS_LABELS[status] || status,
      totalUsd: Number(val.totalUsd.toFixed(2)),
      count: val.count,
    }));

    const topSellingProducts = Array.from(productStatsMap.entries())
      .map(([productId, val]) => ({
        productId,
        productName: val.name,
        quantitySold: val.quantity,
        totalRevenueUsd: Number(val.revenueUsd.toFixed(2)),
      }))
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 10);

    const dailySales = Array.from(dailyMap.entries())
      .map(([date, val]) => ({
        date,
        totalUsd: Number(val.totalUsd.toFixed(2)),
        orderCount: val.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalRevenueUsd: Number(totalRevenueUsd.toFixed(2)),
      totalRevenueVes: Number(totalRevenueVes.toFixed(2)),
      completedOrdersCount,
      pendingOrdersCount,
      cancelledOrdersCount,
      totalOrdersCount,
      averageTicketUsd,
      itemsSoldTotal,
      revenueByMethod,
      revenueByStatus,
      topSellingProducts,
      dailySales,
    };
  }

/**
   * Get Payments for Tenant Admin
   */
  static async getTenantPayments(tenantId: string): Promise<PaymentProof[]> {
    const resolvedTenant = await TenantRepository.getTenant(tenantId);
    const actualTenantId = resolvedTenant?.id || tenantId;

    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .or(`tenant_id.eq.${actualTenantId},tenant_id.eq.${tenantId}`)
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        return data as PaymentProof[];
      }
      if (!error && Array.isArray(data) && isLiveDatabaseConfigured()) {
        return [];
      }
    }

    if (isLiveDatabaseConfigured()) return [];
    return state.payments.filter((p) => p.tenant_id === actualTenantId || p.tenant_id === tenantId);
  }

/**
   * Review & Approve/Reject Payment
   */
  static async reviewPayment(
    tenantId: string,
    paymentId: string,
    status: PaymentStatus,
    rejectionReason?: string,
    actor?: AuditActor | string | null
  ): Promise<PaymentProof | null> {
    const actorObj: AuditActor =
      typeof actor === "string"
        ? { id: actor, name: "Admin Operativo", email: null, role: "ADMIN" }
        : actor || { id: null, name: "Admin Operativo", email: null, role: "ADMIN" };

    const supabase = getSupabase();
    let updatedSupabasePayment: PaymentProof | null = null;
    let orderIdToUpdate: string | null = null;
    let paymentCurrency = "VES";
    let paymentAmount = 0;
    let paymentMethod = "";
    let paymentRef = "";
    let orderNumber = "";

    if (supabase) {
      try {
        const { data: paymentRow } = await supabase
          .from("payments")
          .select("order_id, currency, amount, method, reference_number")
          .eq("id", paymentId)
          .eq("tenant_id", tenantId)
          .maybeSingle();

        orderIdToUpdate = paymentRow?.order_id || null;
        if (paymentRow?.currency) paymentCurrency = paymentRow.currency;
        if (paymentRow?.amount) paymentAmount = Number(paymentRow.amount);
        if (paymentRow?.method) paymentMethod = paymentRow.method;
        if (paymentRow?.reference_number) paymentRef = paymentRow.reference_number;

        const { data: updatedPaymentRow } = await supabase
          .from("payments")
          .update({
            status,
            reviewed_at: new Date().toISOString(),
            rejection_reason: rejectionReason || null,
          })
          .eq("id", paymentId)
          .eq("tenant_id", tenantId)
          .select("*")
          .maybeSingle();

        if (updatedPaymentRow) {
          updatedSupabasePayment = {
            id: updatedPaymentRow.id,
            tenant_id: updatedPaymentRow.tenant_id,
            order_id: updatedPaymentRow.order_id,
            method: updatedPaymentRow.method,
            bank_name: updatedPaymentRow.bank_name || null,
            reference_number: updatedPaymentRow.reference_number || null,
            amount: Number(updatedPaymentRow.amount),
            currency: (updatedPaymentRow.currency === "USD" ? "USD" : "VES") as CurrencyCode,
            payment_date: updatedPaymentRow.payment_date,
            proof_image_url: updatedPaymentRow.proof_image_url || null,
            status: updatedPaymentRow.status,
            reviewed_by: updatedPaymentRow.reviewed_by || null,
            reviewed_at: updatedPaymentRow.reviewed_at,
            rejection_reason: updatedPaymentRow.rejection_reason || null,
            created_at: updatedPaymentRow.created_at,
          };
        }

        if (orderIdToUpdate) {
          const newOrderStatus: OrderStatus =
            status === "APPROVED" ? "PREPARING" : "CANCELLED";

          let fiscalPayload: Record<string, any> = {};
          if (status === "APPROVED") {
            try {
              const activeModules = await TenantRepository.getTenantActiveModuleIds(tenantId);
              const isVenezuelaActive = activeModules.includes("local_venezuela");
              const settings = await TenantRepository.getTenantSettings(tenantId);
              if (isVenezuelaActive && settings?.billing_settings?.fiscal_billing_enabled) {
                const { data: ordRow } = await supabase
                  .from("orders")
                  .select("total_usd, total_ves, exchange_rate_applied, order_number")
                  .eq("id", orderIdToUpdate)
                  .maybeSingle();

                if (ordRow?.order_number) orderNumber = ordRow.order_number;
                const totUsd = Number(ordRow?.total_usd || 0);
                const exRate = Number(ordRow?.exchange_rate_applied || 1);
                const ivaRate = (settings.billing_settings.default_iva_rate || 16) / 100;
                const baseImponible = Number((totUsd / (1 + ivaRate)).toFixed(2));
                const ivaUsd = Number((totUsd - baseImponible).toFixed(2));
                const ivaVes = Number((ivaUsd * exRate).toFixed(2));

                const isForeignPayment = paymentCurrency === "USD";
                let igtfUsd = 0;
                let igtfVes = 0;
                if (settings.billing_settings.apply_igtf && isForeignPayment) {
                  igtfUsd = Number((totUsd * 0.03).toFixed(2));
                  igtfVes = Number((igtfUsd * exRate).toFixed(2));
                }

                const invSeq = Date.now().toString().slice(-8);
                const invNum = `FACT-${invSeq}`;
                const ctrlNum = `00-${invSeq}`;
                const rif = settings.billing_settings.emitter_fiscal_data?.rif || "";

                fiscalPayload = {
                  is_fiscal_invoice: true,
                  fiscal_invoice_number: invNum,
                  fiscal_control_number: ctrlNum,
                  fiscal_cuv: `CUV-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
                  fiscal_qr_url: `https://fiscal.seniat.gob.ve/verificar?rif=${encodeURIComponent(rif)}&factura=${invNum}&control=${ctrlNum}`,
                  subtotal_exempt_usd: 0,
                  subtotal_taxable_usd: baseImponible,
                  iva_amount_usd: ivaUsd,
                  iva_amount_ves: ivaVes,
                  igtf_amount_usd: igtfUsd,
                  igtf_amount_ves: igtfVes,
                };
              }
            } catch (err) {
              console.warn("[MarketOS] Fiscal generation error:", err);
            }
          }

          await supabase
            .from("orders")
            .update({
              status: newOrderStatus,
              ...fiscalPayload,
              updated_at: new Date().toISOString(),
            })
            .eq("id", orderIdToUpdate)
            .eq("tenant_id", tenantId);

          if (status === "REJECTED") {
            await OrderRepository.restoreOrderInventoryStock(tenantId, orderIdToUpdate);
          }
        }
      } catch (e) {
        console.warn("[Supabase] Update payment fallback to state:", e);
      }
    }

    const payment = state.payments.find(
      (p) => p.id === paymentId && p.tenant_id === tenantId
    );
    if (payment) {
      payment.status = status;
      payment.reviewed_at = new Date().toISOString();
      if (rejectionReason) payment.rejection_reason = rejectionReason;
      if (payment.currency) paymentCurrency = payment.currency;
      if (payment.amount) paymentAmount = payment.amount;
      if (payment.method) paymentMethod = payment.method;
      if (payment.reference_number) paymentRef = payment.reference_number;

      const order = state.orders.find((o) => o.id === payment.order_id);
      if (order) {
        if (!orderNumber && order.order_number) orderNumber = order.order_number;
        if (status === "APPROVED") {
          order.status = "PREPARING";
          await FoodServiceRepository.deductRecipeInventoryForOrder(order);
          const activeModules = await TenantRepository.getTenantActiveModuleIds(tenantId);
          const isVenezuelaActive = activeModules.includes("local_venezuela");
          const settings = state.settings.find((s) => s.tenant_id === tenantId);
          if (isVenezuelaActive && settings?.billing_settings?.fiscal_billing_enabled) {
            const totUsd = order.total_usd || 0;
            const exRate = order.exchange_rate_applied || 1;
            const ivaRate = (settings.billing_settings.default_iva_rate || 16) / 100;
            const baseImponible = Number((totUsd / (1 + ivaRate)).toFixed(2));
            const ivaUsd = Number((totUsd - baseImponible).toFixed(2));
            const ivaVes = Number((ivaUsd * exRate).toFixed(2));
            const isForeignPayment =
              payment.currency === "USD" ||
              order.payment_method === "CASH_USD" ||
              order.payment_method === "ZELLE";
            let igtfUsd = 0;
            let igtfVes = 0;
            if (settings.billing_settings.apply_igtf && isForeignPayment) {
              igtfUsd = Number((totUsd * 0.03).toFixed(2));
              igtfVes = Number((igtfUsd * exRate).toFixed(2));
            }
            const invSeq = Date.now().toString().slice(-8);
            const invNum = `FACT-${invSeq}`;
            const ctrlNum = `00-${invSeq}`;
            const rif = settings.billing_settings.emitter_fiscal_data?.rif || "";

            order.is_fiscal_invoice = true;
            order.fiscal_invoice_number = invNum;
            order.fiscal_control_number = ctrlNum;
            order.fiscal_cuv = `CUV-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
            order.fiscal_qr_url = `https://fiscal.seniat.gob.ve/verificar?rif=${encodeURIComponent(rif)}&factura=${invNum}&control=${ctrlNum}`;
            order.subtotal_exempt_usd = 0;
            order.subtotal_taxable_usd = baseImponible;
            order.iva_amount_usd = ivaUsd;
            order.iva_amount_ves = ivaVes;
            order.igtf_amount_usd = igtfUsd;
            order.igtf_amount_ves = igtfVes;
          }
        } else if (status === "REJECTED") {
          order.status = "CANCELLED";
          await OrderRepository.restoreOrderInventoryStock(tenantId, payment.order_id);
        }
        order.payment_status = status;
        order.updated_at = new Date().toISOString();
      }
    }

    const targetOrderId = orderIdToUpdate || payment?.order_id || "";
    if (!orderNumber && targetOrderId) {
      const ord = state.orders.find((o) => o.id === targetOrderId);
      if (ord) orderNumber = ord.order_number;
    }

    await AuditRepository.recordAuditLog({
      tenantId,
      actorId: actorObj.id,
      actorName: actorObj.name,
      actorEmail: actorObj.email,
      actorRole: actorObj.role,
      action: status === "APPROVED" ? "PAYMENT_APPROVED" : "PAYMENT_REJECTED",
      entity: "payments",
      entityId: paymentId,
      newData: {
        status,
        rejection_reason: rejectionReason || null,
        order_id: targetOrderId,
        order_number: orderNumber || "N/A",
        amount: paymentAmount,
        currency: paymentCurrency,
        method: paymentMethod,
        reference_number: paymentRef,
      },
    });

    if (updatedSupabasePayment) {
      return updatedSupabasePayment;
    }

    if (payment) {
      return payment;
    }

    if (targetOrderId) {
      return {
        id: paymentId,
        tenant_id: tenantId,
        order_id: targetOrderId,
        method: (paymentMethod || "PAGO_MOVIL") as any,
        bank_name: null,
        reference_number: paymentRef || null,
        amount: paymentAmount,
        currency: (paymentCurrency === "USD" ? "USD" : "VES") as CurrencyCode,
        payment_date: new Date().toISOString().split("T")[0],
        proof_image_url: null,
        status,
        reviewed_by: actorObj.id || null,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectionReason || null,
        created_at: new Date().toISOString(),
      };
    }

    return null;
  }

/**
   * Revert / Return inventory stock when an order is cancelled or payment rejected
   */
  static async restoreOrderInventoryStock(
    tenantId: string,
    orderId?: string | null
  ): Promise<void> {
    if (!orderId) return;
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: ord } = await supabase
          .from("orders")
          .select("id, store_id, tenant_id")
          .eq("id", orderId)
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (!ord) return;

        const storeId = ord.store_id;
        const targetTenantId = ord.tenant_id;

        const { data: items } = await supabase
          .from("order_items")
          .select("product_id, quantity, product_name")
          .eq("order_id", orderId)
          .eq("tenant_id", tenantId);

        if (items && items.length > 0 && storeId) {
          for (const item of items) {
            if (item.product_id) {
              const { data: inv } = await supabase
                .from("inventory")
                .select("id, quantity")
                .eq("store_id", storeId)
                .eq("product_id", item.product_id)
                .maybeSingle();

              if (inv) {
                const newQty = inv.quantity + item.quantity;
                await supabase
                  .from("inventory")
                  .update({
                    quantity: newQty,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", inv.id);

                await supabase.from("inventory_movements").insert({
                  tenant_id: targetTenantId,
                  store_id: storeId,
                  product_id: item.product_id,
                  quantity_change: item.quantity,
                  previous_quantity: inv.quantity,
                  new_quantity: newQty,
                  reason: "CANCELLATION",
                });
              } else {
                await supabase
                  .from("inventory")
                  .upsert(
                    {
                      tenant_id: targetTenantId,
                      store_id: storeId,
                      product_id: item.product_id,
                      quantity: item.quantity,
                      min_quantity: 5,
                      updated_at: new Date().toISOString(),
                    },
                    { onConflict: "store_id, product_id" }
                  );

                await supabase.from("inventory_movements").insert({
                  tenant_id: targetTenantId,
                  store_id: storeId,
                  product_id: item.product_id,
                  quantity_change: item.quantity,
                  previous_quantity: 0,
                  new_quantity: item.quantity,
                  reason: "CANCELLATION",
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn("[MarketOS] Revert inventory error:", err);
      }
    }

    // In-memory state rollback
    const memOrder = state.orders.find((o) => o.id === orderId);
    if (memOrder && memOrder.items) {
      for (const item of memOrder.items) {
        const prod = state.products.find(
          (p) => p.id === item.product_id || p.name === item.product_name
        );
        if (prod) {
          prod.stock += item.quantity;
        }
      }
      await FoodServiceRepository.restoreRecipeInventoryForOrder(memOrder);
    }
  }

/**
   * Update Order delivery/preparation status and assign driver
   */
  static async updateOrderStatus(
    tenantId: string,
    orderId: string,
    status: OrderStatus,
    driverId?: string,
    actor?: AuditActor | string | null,
    cancellationReason?: string
  ): Promise<Order | null> {
    const actorObj: AuditActor =
      typeof actor === "string"
        ? { id: actor, name: "Admin Operativo", email: null, role: "ADMIN" }
        : actor || { id: null, name: "Admin Operativo", email: null, role: "ADMIN" };

    const supabase = getSupabase();
    let orderNum = "";
    let custName = "";
    let custPhone = "";
    let totalUsd = 0;
    let oldStatus: OrderStatus = "CREATED";
    let isDbUpdated = false;
    let ordRowData: any = null;

    if (supabase) {
      try {
        const updateData: Record<string, unknown> = {
          status,
          updated_at: new Date().toISOString(),
        };
        if (driverId) updateData.driver_id = driverId;

        const { data: ordRow } = await supabase
          .from("orders")
          .select("order_number, customer_name, customer_phone, total_usd, status, customer_id, store_id, total_ves, exchange_rate_applied, delivery_type")
          .eq("id", orderId)
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (ordRow) {
          ordRowData = ordRow;
          orderNum = ordRow.order_number || "";
          custName = ordRow.customer_name || "";
          custPhone = ordRow.customer_phone || "";
          totalUsd = Number(ordRow.total_usd || 0);
          if (ordRow.status) oldStatus = ordRow.status as OrderStatus;
        }

        const { error: updErr } = await supabase
          .from("orders")
          .update(updateData)
          .eq("id", orderId)
          .eq("tenant_id", tenantId);

        if (!updErr) {
          isDbUpdated = true;
        }

        if (status === "CANCELLED" && oldStatus !== "CANCELLED") {
          await OrderRepository.restoreOrderInventoryStock(tenantId, orderId);
          // Restore coupon usage if order used a coupon
          const { data: ordWithCoupon } = await supabase
            .from("orders")
            .select("coupon_id")
            .eq("id", orderId)
            .maybeSingle();
          if (ordWithCoupon?.coupon_id) {
            const { data: cData } = await supabase
              .from("coupons")
              .select("usage_count")
              .eq("id", ordWithCoupon.coupon_id)
              .maybeSingle();
            if (cData && Number(cData.usage_count) > 0) {
              await supabase
                .from("coupons")
                .update({ usage_count: Math.max(0, Number(cData.usage_count) - 1) })
                .eq("id", ordWithCoupon.coupon_id);
            }
          }
        }
      } catch (e) {
        console.warn("[MarketOS] Update order status in Supabase error:", e);
      }
    }

    const isCancellation = status === "CANCELLED";

    const memOrder = state.orders.find(
      (o) => o.id === orderId && o.tenant_id === tenantId
    );
    if (memOrder) {
      oldStatus = memOrder.status;
      memOrder.status = status;
      if (driverId) memOrder.driver_id = driverId;
      memOrder.updated_at = new Date().toISOString();

      if (!orderNum && memOrder.order_number) orderNum = memOrder.order_number;
      if (!custName && memOrder.customer_name) custName = memOrder.customer_name;
      if (!custPhone && memOrder.customer_phone) custPhone = memOrder.customer_phone;
      if (!totalUsd && memOrder.total_usd) totalUsd = memOrder.total_usd;

      if (status === "CANCELLED" && oldStatus !== "CANCELLED") {
        await OrderRepository.restoreOrderInventoryStock(tenantId, orderId);
        if (memOrder.coupon_id) {
          const memCoupon = state.coupons.find((c) => c.id === memOrder.coupon_id);
          if (memCoupon && memCoupon.usage_count > 0) {
            memCoupon.usage_count -= 1;
          }
        }
      }

      if (status === "PREPARING" && oldStatus !== "PREPARING") {
        await FoodServiceRepository.deductRecipeInventoryForOrder(memOrder);
      }
    }

    // Always record audit log for status change
    await AuditRepository.recordAuditLog({
      tenantId,
      actorId: actorObj.id,
      actorName: actorObj.name,
      actorEmail: actorObj.email,
      actorRole: actorObj.role,
      action: isCancellation ? "ORDER_CANCELLED" : "ORDER_STATUS_CHANGED",
      entity: "orders",
      entityId: orderId,
      oldData: { status: oldStatus },
      newData: {
        status,
        driver_id: driverId,
        order_number: orderNum || orderId,
        customer_name: custName,
        customer_phone: custPhone,
        total_usd: totalUsd,
        ...(isCancellation
          ? {
              cancellation_reason:
                cancellationReason || "Anulación administrativa de orden",
              inventory_restored: true,
            }
          : {}),
      },
    });

    if (memOrder) {
      return memOrder;
    }

    // If order was in Supabase, fetch and return the fresh enriched order
    if (isDbUpdated || supabase) {
      try {
        const tenantOrders = await OrderRepository.getTenantOrders(tenantId);
        const fresh = tenantOrders.find((o) => o.id === orderId);
        if (fresh) {
          const existingIdx = state.orders.findIndex((o) => o.id === orderId);
          if (existingIdx >= 0) {
            state.orders[existingIdx] = fresh;
          } else {
            state.orders.unshift(fresh);
          }
          return fresh;
        }
      } catch (e) {
        console.warn("[MarketOS] getTenantOrders fallback warning in updateOrderStatus:", e);
      }
    }

    if (isDbUpdated) {
      const fallbackOrder: Order = {
        id: orderId,
        tenant_id: tenantId,
        store_id: ordRowData?.store_id || "",
        customer_id: ordRowData?.customer_id || "cust-guest",
        order_number: orderNum || `ORD-${orderId.slice(-6)}`,
        customer_name: custName || "Cliente",
        customer_phone: custPhone || "",
        total_usd: totalUsd,
        total_ves: ordRowData?.total_ves ? Number(ordRowData.total_ves) : 0,
        exchange_rate_applied: ordRowData?.exchange_rate_applied ? Number(ordRowData.exchange_rate_applied) : 0,
        status,
        driver_id: driverId || null,
        delivery_type: (ordRowData?.delivery_type || "delivery") as any,
        items: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      state.orders.unshift(fallbackOrder);
      return fallbackOrder;
    }

    return null;
  }

/**
   * Asociar factura física de máquina fiscal de mostrador a un pedido (Providencia 00071)
   */
  static async registerPhysicalFiscalInvoice(
    tenantId: string,
    orderId: string,
    physicalInvoiceNumber: string,
    physicalMachineSerial?: string
  ): Promise<Order> {
    const supabase = getSupabase();
    const cleanInvoiceNumber = physicalInvoiceNumber.trim().toUpperCase();
    const cleanSerial = physicalMachineSerial ? physicalMachineSerial.trim().toUpperCase() : null;
    const nowIso = new Date().toISOString();

    if (supabase) {
      try {
        await supabase
          .from("orders")
          .update({
            physical_invoice_number: cleanInvoiceNumber,
            physical_machine_serial: cleanSerial,
            physical_fiscal_registered_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", orderId)
          .eq("tenant_id", tenantId);
      } catch (e) {
        console.warn("[MarketOS] registerPhysicalFiscalInvoice Supabase warning:", e);
      }
    }

    const order = state.orders.find((o) => o.id === orderId && o.tenant_id === tenantId);
    if (order) {
      order.physical_invoice_number = cleanInvoiceNumber;
      order.physical_machine_serial = cleanSerial;
      order.physical_fiscal_registered_at = nowIso;
      order.updated_at = nowIso;
      return order;
    }

    const allOrders = await this.getTenantOrders(tenantId);
    const fetched = allOrders.find((o) => o.id === orderId);
    if (!fetched) {
      throw new Error(`Pedido no encontrado: ${orderId}`);
    }
    return fetched;
  }

/**
   * Get Customer Profile, Order History and Loyalty Points
   */
  static async getCustomerOrdersAndPoints(
    tenantId: string,
    phoneOrEmail: string
  ): Promise<CustomerAccountSummary | null> {
    const rawInput = (phoneOrEmail || "").trim();
    if (!rawInput) return null;

    const cleanPhone = rawInput.replace(/\D/g, "");
    const supabase = getSupabase();

    if (supabase) {
      try {
        let customer: any = null;

        // 1. Try search by Order Number (e.g. ORD-289699 or numeric part)
        if (rawInput.toUpperCase().startsWith("ORD-") || /^\d{5,8}$/.test(rawInput)) {
          const { data: orderMatch } = await supabase
            .from("orders")
            .select("customer_id")
            .eq("tenant_id", tenantId)
            .ilike("order_number", `%${rawInput}%`)
            .limit(1)
            .maybeSingle();

          if (orderMatch?.customer_id) {
            const { data: byOrderCust } = await supabase
              .from("customers")
              .select("*")
              .eq("id", orderMatch.customer_id)
              .maybeSingle();
            customer = byOrderCust;
          }
        }

        // 2. Try Cédula / RIF match on id_number
        if (!customer) {
          if (cleanPhone.length >= 5) {
            const { data: byCi } = await supabase
              .from("customers")
              .select("*")
              .eq("tenant_id", tenantId)
              .or(`id_number.eq.${rawInput},id_number.ilike.%${cleanPhone}%`)
              .limit(1)
              .maybeSingle();
            customer = byCi;
          } else if (rawInput.includes("-")) {
            const { data: byCiExact } = await supabase
              .from("customers")
              .select("*")
              .eq("tenant_id", tenantId)
              .eq("id_number", rawInput)
              .maybeSingle();
            customer = byCiExact;
          }
        }

        // 3. Try exact phone match
        if (!customer) {
          const { data: byExactPhone } = await supabase
            .from("customers")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("phone", rawInput)
            .maybeSingle();
          customer = byExactPhone;
        }

        // 4. Try fuzzy last-7-digit phone match
        if (!customer && cleanPhone.length >= 7) {
          const { data: byCleanPhone } = await supabase
            .from("customers")
            .select("*")
            .eq("tenant_id", tenantId)
            .ilike("phone", `%${cleanPhone.slice(-7)}%`)
            .maybeSingle();

          customer = byCleanPhone;
        }

        // 5. Try email match
        if (!customer && rawInput.includes("@")) {
          const { data: byEmail } = await supabase
            .from("customers")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("email", rawInput.toLowerCase())
            .maybeSingle();

          customer = byEmail;
        }

        if (customer) {
          const { data: rawOrders } = await supabase
            .from("orders")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("customer_id", customer.id)
            .order("created_at", { ascending: false });

          const orderList = (rawOrders as any[]) || [];
          let enrichedOrders: Order[] = [];

          if (orderList.length > 0) {
            const orderIds = orderList.map((o) => o.id);
            const storeIds = Array.from(new Set(orderList.map((o) => o.store_id).filter(Boolean)));

            const [itemsRes, payRes, storesRes] = await Promise.all([
              supabase.from("order_items").select("*").in("order_id", orderIds),
              supabase.from("payments").select("*").in("order_id", orderIds),
              storeIds.length > 0
                ? supabase.from("stores").select("id, name").in("id", storeIds)
                : Promise.resolve({ data: [] }),
            ]);

            const itemsMap = new Map<string, OrderItem[]>();
            ((itemsRes as any)?.data || []).forEach((item: OrderItem) => {
              const list = itemsMap.get(item.order_id) || [];
              list.push(item);
              itemsMap.set(item.order_id, list);
            });

            const payMap = new Map<string, any>();
            ((payRes as any)?.data || []).forEach((p: any) => payMap.set(p.order_id, p));

            const storeMap = new Map<string, string>();
            ((storesRes as any)?.data || []).forEach((s: any) => storeMap.set(s.id, s.name));

            enrichedOrders = orderList.map((o) => {
              const pay = payMap.get(o.id);
              const storeName = storeMap.get(o.store_id);
              const gpsInfo = extractGpsCoordinates(o.delivery_address);
              const deliveryLat = gpsInfo.lat ?? (o as any).delivery_latitude ?? null;
              const deliveryLng = gpsInfo.lng ?? (o as any).delivery_longitude ?? null;
              const deliveryMapsUrl = gpsInfo.mapsUrl || (deliveryLat && deliveryLng ? `https://www.google.com/maps?q=${deliveryLat},${deliveryLng}` : null);

              return {
                ...o,
                items: itemsMap.get(o.id) || [],
                customer_name: customer.name,
                customer_phone: customer.phone,
                customer_id_number: customer.id_number || (o as any).customer_id_number || null,
                customer_email: customer.email,
                payment_method: pay?.method,
                payment_reference: pay?.reference_number,
                payment_status: pay?.status,
                proof_image_url: pay?.proof_image_url,
                store_name: storeName,
                delivery_latitude: deliveryLat,
                delivery_longitude: deliveryLng,
                delivery_maps_url: deliveryMapsUrl,
              } as Order;
            });
          }

          const totalSpentUsd = enrichedOrders.reduce(
            (sum, o) => sum + Number(o.total_usd),
            0
          );

          return {
            customer: customer as Customer,
            orders: enrichedOrders,
            totalSpentUsd: Number(totalSpentUsd.toFixed(2)),
            loyaltyPoints: customer.loyalty_points || 0,
          };
        }
      } catch (e) {
        console.warn("[MarketOS] Error fetching customer in Supabase:", e);
      }
    }

    const memoryCustomer =
      state.customers.find((c) => {
        if (c.tenant_id !== tenantId) return false;
        if (c.email && c.email.toLowerCase() === rawInput.toLowerCase()) return true;
        if (c.phone === rawInput) return true;
        if (
          c.id_number &&
          (c.id_number.toLowerCase() === rawInput.toLowerCase() ||
            (cleanPhone.length >= 5 &&
              c.id_number.replace(/\D/g, "").includes(cleanPhone)))
        ) {
          return true;
        }
        if (cleanPhone.length >= 7 && c.phone.replace(/\D/g, "").includes(cleanPhone.slice(-7))) {
          return true;
        }
        return false;
      }) ||
      (() => {
        const matchedOrder = state.orders.find(
          (o) =>
            o.tenant_id === tenantId &&
            o.order_number.toLowerCase().includes(rawInput.toLowerCase())
        );
        if (matchedOrder && matchedOrder.customer_id) {
          return state.customers.find((c) => c.id === matchedOrder.customer_id);
        }
        return undefined;
      })();

    if (memoryCustomer) {
      const orders = state.orders
        .filter((o) => o.tenant_id === tenantId && o.customer_id === memoryCustomer.id)
        .map((o) => {
          const pay = state.payments.find((p) => p.order_id === o.id);
          const st = state.stores.find((s) => s.id === o.store_id);
          return {
            ...o,
            customer_name: memoryCustomer.name,
            customer_phone: memoryCustomer.phone,
            customer_id_number: memoryCustomer.id_number || (o as any).customer_id_number || null,
            payment_method: pay?.method || o.payment_method,
            payment_reference: pay?.reference_number || o.payment_reference,
            payment_status: pay?.status || o.payment_status,
            proof_image_url: pay?.proof_image_url || o.proof_image_url,
            store_name: st?.name || o.store_name,
          };
        });

      const totalSpentUsd = orders.reduce((sum, o) => sum + o.total_usd, 0);
      return {
        customer: memoryCustomer,
        orders,
        totalSpentUsd,
        loyaltyPoints: memoryCustomer.loyalty_points || 0,
      };
    }

    return null;
  }

/**
   * Get Orders for a specific customer by phone, Cédula, order number, or ID with full item enrichment
   */
  static async getCustomerOrders(
    tenantId: string,
    phoneOrId: string
  ): Promise<Order[]> {
    const rawQuery = (phoneOrId || "").trim();
    if (!rawQuery) return [];

    const cleanDigits = rawQuery.replace(/\D/g, "");
    const supabase = getSupabase();

    if (supabase) {
      try {
        const matchedOrderIds = new Set<string>();

        // 1. Search by Order Number (e.g. ORD-123456 or partial digits)
        const { data: byOrderNum } = await supabase
          .from("orders")
          .select("id")
          .eq("tenant_id", tenantId)
          .ilike("order_number", `%${rawQuery}%`);

        (byOrderNum || []).forEach((o: any) => matchedOrderIds.add(o.id));

        // 2. If phone search has >= 7 digits, find customers by phone then their orders
        if (cleanDigits.length >= 7) {
          const { data: matchedCusts } = await supabase
            .from("customers")
            .select("id")
            .eq("tenant_id", tenantId)
            .ilike("phone", `%${cleanDigits.slice(-7)}%`);

          const custIds = (matchedCusts || []).map((c: any) => c.id);
          if (custIds.length > 0) {
            const { data: byCust } = await supabase
              .from("orders")
              .select("id")
              .eq("tenant_id", tenantId)
              .in("customer_id", custIds);

            (byCust || []).forEach((o: any) => matchedOrderIds.add(o.id));
          }
        }

        // 3. Search by Customer Cédula / RIF (id_number)
        if (cleanDigits.length >= 5 || rawQuery.includes("-")) {
          const { data: matchedCiCusts } = await supabase
            .from("customers")
            .select("id")
            .eq("tenant_id", tenantId)
            .or(`id_number.eq.${rawQuery},id_number.ilike.%${cleanDigits}%`);

          const ciCustIds = (matchedCiCusts || []).map((c: any) => c.id);
          if (ciCustIds.length > 0) {
            const { data: byCiOrders } = await supabase
              .from("orders")
              .select("id")
              .eq("tenant_id", tenantId)
              .in("customer_id", ciCustIds);

            (byCiOrders || []).forEach((o: any) => matchedOrderIds.add(o.id));
          }
        }

        // 4. If query is a valid UUID, search by exact order ID or customer ID
        if (isUuid(rawQuery)) {
          const { data: byUuid } = await supabase
            .from("orders")
            .select("id")
            .eq("tenant_id", tenantId)
            .or(`id.eq.${rawQuery},customer_id.eq.${rawQuery}`);

          (byUuid || []).forEach((o: any) => matchedOrderIds.add(o.id));
        }

        // 5. Also search by delivery address or notes containing phone/reference
        const { data: byText } = await supabase
          .from("orders")
          .select("id")
          .eq("tenant_id", tenantId)
          .or(`delivery_address.ilike.%${rawQuery}%,notes.ilike.%${rawQuery}%`);

        (byText || []).forEach((o: any) => matchedOrderIds.add(o.id));

        if (matchedOrderIds.size > 0) {
          const orderIds = Array.from(matchedOrderIds);
          const { data: rawOrders, error } = await supabase
            .from("orders")
            .select("*")
            .in("id", orderIds)
            .order("created_at", { ascending: false });

          if (!error && rawOrders && rawOrders.length > 0) {
            const customerIds = Array.from(
              new Set(rawOrders.map((o: any) => o.customer_id).filter(Boolean))
            );
            const storeIds = Array.from(
              new Set(rawOrders.map((o: any) => o.store_id).filter(Boolean))
            );

            // Enrich orders with items, customer details, payment proof and store names
            const [itemsRes, custRes, payRes, storesRes] = await Promise.all([
              supabase.from("order_items").select("*").in("order_id", orderIds),
              customerIds.length > 0
                ? supabase.from("customers").select("id, name, phone, email, id_number").in("id", customerIds)
                : Promise.resolve({ data: [] }),
              supabase.from("payments").select("*").in("order_id", orderIds),
              storeIds.length > 0
                ? supabase.from("stores").select("id, name").in("id", storeIds)
                : Promise.resolve({ data: [] }),
            ]);

            const itemsMap = new Map<string, OrderItem[]>();
            ((itemsRes as any)?.data || []).forEach((item: OrderItem) => {
              const list = itemsMap.get(item.order_id) || [];
              list.push(item);
              itemsMap.set(item.order_id, list);
            });

            const custMap = new Map<string, any>();
            ((custRes as any)?.data || []).forEach((c: any) => custMap.set(c.id, c));

            const payMap = new Map<string, any>();
            ((payRes as any)?.data || []).forEach((p: any) => payMap.set(p.order_id, p));

            const storeMap = new Map<string, string>();
            ((storesRes as any)?.data || []).forEach((s: any) => storeMap.set(s.id, s.name));

            return rawOrders.map((o: any) => {
              const cust = custMap.get(o.customer_id);
              const pay = payMap.get(o.id);
              const storeName = storeMap.get(o.store_id);
              const gpsInfo = extractGpsCoordinates(o.delivery_address);
              const deliveryLat = gpsInfo.lat ?? o.delivery_latitude ?? null;
              const deliveryLng = gpsInfo.lng ?? o.delivery_longitude ?? null;
              const deliveryMapsUrl = gpsInfo.mapsUrl || (deliveryLat && deliveryLng ? `https://www.google.com/maps?q=${deliveryLat},${deliveryLng}` : null);

              return {
                ...o,
                items: itemsMap.get(o.id) || [],
                customer_name: cust?.name || o.customer_name,
                customer_phone: cust?.phone || o.customer_phone,
                customer_id_number: cust?.id_number || o.customer_id_number || null,
                customer_email: cust?.email || o.customer_email,
                payment_method: pay?.method,
                payment_reference: pay?.reference_number,
                payment_status: pay?.status,
                proof_image_url: pay?.proof_image_url,
                store_name: storeName,
                delivery_latitude: deliveryLat,
                delivery_longitude: deliveryLng,
                delivery_maps_url: deliveryMapsUrl,
              } as Order;
            });
          }
        }
      } catch (err) {
        console.warn("[MarketOS] getCustomerOrders Supabase error:", err);
      }
    }

    // In-memory fallback
    if (isLiveDatabaseConfigured()) return [];
    return state.orders
      .filter((o) => {
        if (o.tenant_id !== tenantId) return false;
        if (o.order_number.toLowerCase().includes(rawQuery.toLowerCase())) return true;
        if (o.id === rawQuery) return true;
        if (o.customer_id === rawQuery) return true;
        if (
          cleanDigits.length >= 5 &&
          o.customer_id_number &&
          o.customer_id_number.replace(/\D/g, "").includes(cleanDigits)
        ) {
          return true;
        }
        if (
          o.customer_id_number &&
          o.customer_id_number.toLowerCase().includes(rawQuery.toLowerCase())
        ) {
          return true;
        }
        if (
          cleanDigits.length >= 7 &&
          o.customer_phone &&
          o.customer_phone.replace(/\D/g, "").includes(cleanDigits.slice(-7))
        ) {
          return true;
        }
        if (
          o.customer_name &&
          o.customer_name.toLowerCase().includes(rawQuery.toLowerCase())
        ) {
          return true;
        }
        if (
          o.delivery_address &&
          o.delivery_address.toLowerCase().includes(rawQuery.toLowerCase())
        ) {
          return true;
        }
        return false;
      })
      .map((o) => {
        const pay = state.payments.find((p) => p.order_id === o.id);
        const cust = state.customers.find((c) => c.id === o.customer_id);
        const st = state.stores.find((s) => s.id === o.store_id);
        const gpsInfo = extractGpsCoordinates(o.delivery_address);
        const deliveryLat = gpsInfo.lat ?? o.delivery_latitude ?? null;
        const deliveryLng = gpsInfo.lng ?? o.delivery_longitude ?? null;
        const deliveryMapsUrl = gpsInfo.mapsUrl || (deliveryLat && deliveryLng ? `https://www.google.com/maps?q=${deliveryLat},${deliveryLng}` : null);

        return {
          ...o,
          customer_name: cust?.name || o.customer_name,
          customer_phone: cust?.phone || o.customer_phone,
          customer_id_number: cust?.id_number || o.customer_id_number || null,
          customer_email: cust?.email || o.customer_email,
          payment_method: pay?.method || o.payment_method,
          payment_reference: pay?.reference_number || o.payment_reference,
          payment_status: pay?.status || o.payment_status,
          proof_image_url: pay?.proof_image_url || o.proof_image_url,
          store_name: st?.name || o.store_name,
          delivery_latitude: deliveryLat,
          delivery_longitude: deliveryLng,
          delivery_maps_url: deliveryMapsUrl,
        };
      });
  }
}
