"use server";

import {
  MarketOSRepository,
  CreateOrderInput,
  SubmitPaymentInput,
} from "@marketos/database";
import type { Order } from "@marketos/types";
import { revalidatePath } from "next/cache";

export type CreateOrderResult =
  | { success: true; order: Order; error?: never }
  | { success: false; error: string; order?: never };

// In-flight promise map and short-term idempotency cache (Zero Redis Dependency)
const inFlightOrders = new Map<
  string,
  {
    promise: Promise<CreateOrderResult>;
    timestamp: number;
    result?: CreateOrderResult;
  }
>();

function cleanupInFlightOrders() {
  const now = Date.now();
  for (const [key, entry] of inFlightOrders.entries()) {
    if (now - entry.timestamp > 30_000) {
      inFlightOrders.delete(key);
    }
  }
}

export async function createOrderAction(input: CreateOrderInput): Promise<CreateOrderResult> {
  cleanupInFlightOrders();

  // Deduplication key: Tenant + Customer Phone + (idempotencyKey or items signature)
  const itemsSignature = (input.items || [])
    .map((i) => `${i.productId}:${i.quantity}`)
    .sort()
    .join(",");
  const cleanPhone = (input.customerPhone || "").replace(/\D/g, "");
  const dedupKey = input.idempotencyKey
    ? `${input.tenantId}:${input.idempotencyKey}`
    : `${input.tenantId}:${cleanPhone}:${itemsSignature}`;

  const existing = inFlightOrders.get(dedupKey);

  // If identical submission was completed in the last 30s, return existing result
  if (existing?.result) {
    console.warn(`[createOrderAction] Returning cached order for duplicate submission: ${dedupKey}`);
    return existing.result;
  }

  // If identical submission is currently processing in-flight, await the same promise!
  if (existing?.promise) {
    console.warn(`[createOrderAction] Piggybacking on in-flight order promise: ${dedupKey}`);
    return await existing.promise;
  }

  // Execute order creation
  const orderPromise: Promise<CreateOrderResult> = (async (): Promise<CreateOrderResult> => {
    try {
      const order = await MarketOSRepository.createOrder(input);
      revalidatePath("/");
      revalidatePath("/admin");
      const res: CreateOrderResult = { success: true, order };
      const current = inFlightOrders.get(dedupKey);
      if (current) {
        current.result = res;
      }
      return res;
    } catch (error) {
      inFlightOrders.delete(dedupKey);
      console.error("Error creating order:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error al procesar el pedido",
      };
    }
  })();

  inFlightOrders.set(dedupKey, {
    promise: orderPromise,
    timestamp: Date.now(),
  });

  return await orderPromise;
}

export async function submitPaymentProofAction(input: SubmitPaymentInput) {
  try {
    const payment = await MarketOSRepository.submitPaymentProof(input);
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true, payment };
  } catch (error) {
    console.error("Error submitting payment proof:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al registrar el comprobante de pago",
    };
  }
}

/**
 * Validate discount coupon code for tenant
 */
export async function validateCouponAction(
  tenantId: string,
  code: string,
  orderAmountUsd: number
) {
  try {
    const res = await MarketOSRepository.validateCoupon(
      tenantId,
      code,
      orderAmountUsd
    );
    return { success: true, ...res };
  } catch (error) {
    console.error("Error validating coupon:", error);
    return {
      success: false,
      valid: false,
      discountUsd: 0,
      message: "Error al validar el cupón",
    };
  }
}

/**
 * Upload payment proof image directly to Cloudflare R2
 */
export async function uploadPaymentProofToR2Action(formData: FormData) {
  try {
    const file = formData.get("file") as File | null;
    const tenantId = (formData.get("tenantId") as string) || "shop-market-ca";

    if (!file || file.size === 0) {
      return { success: false, error: "No se proporcionó ningún archivo" };
    }

    // Limit size to 10MB
    if (file.size > 10 * 1024 * 1024) {
      return { success: false, error: "El comprobante no debe superar los 10MB" };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Dynamic import from utils to prevent client bundling
    const { uploadToR2 } = await import("@marketos/utils");
    const uploadRes = await uploadToR2({
      tenantId,
      folder: "proofs",
      fileName: file.name || "comprobante.jpg",
      body: buffer,
      contentType: file.type || "image/jpeg",
    });

    return {
      success: true,
      url: uploadRes.url,
      key: uploadRes.key,
    };
  } catch (error) {
    console.error("Error uploading to Cloudflare R2:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al subir comprobante a Cloudflare R2",
    };
  }
}

/**
 * Track order status by Order Number or Customer Phone
 */
export async function trackOrderAction(tenantId: string, query: string) {
  try {
    const orders = await MarketOSRepository.getCustomerOrders(tenantId, query);
    return { success: true, orders };
  } catch (error) {
    console.error("Error tracking orders:", error);
    return { success: false, orders: [] };
  }
}

/**
 * Look up customer profile, orders and loyalty points
 */
export async function lookupCustomerAction(
  tenantId: string,
  phoneOrEmail: string
) {
  try {
    const summary = await MarketOSRepository.getCustomerOrdersAndPoints(
      tenantId,
      phoneOrEmail
    );
    return { success: true, summary };
  } catch (error) {
    console.error("Error looking up customer:", error);
    return { success: false, summary: null };
  }
}

/**
 * Get installed and available modules for a tenant (Super Admin operation)
 */
export async function getTenantModulesAction(tenantId: string) {
  try {
    const modules = await MarketOSRepository.getTenantModules(tenantId);
    return { success: true, modules };
  } catch (error) {
    console.error("Error fetching tenant modules:", error);
    return { success: false, error: "Error al consultar los módulos del comercio" };
  }
}

/**
 * Enable or disable a plugin/module for a specific tenant (Super Admin operation)
 */
export async function setTenantModuleStatusAction(
  tenantId: string,
  moduleId: import("@marketos/types").TenantModuleId,
  isEnabled: boolean
) {
  try {
    const { getCurrentUser } = await import("./login/actions");
    const user = await getCurrentUser();
    if (!user || user.role !== "PLATFORM_SUPER_ADMIN") {
      return {
        success: false,
        error: "No autorizado. Se requieren permisos de Super Administrador.",
      };
    }
    const success = await MarketOSRepository.setTenantModuleStatus(
      tenantId,
      moduleId,
      isEnabled
    );
    revalidatePath("/platform");
    revalidatePath("/admin");
    revalidatePath("/");
    return { success: Boolean(success) };
  } catch (error) {
    console.error("Error setting tenant module status:", error);
    return { success: false, error: "Error al actualizar el estado del módulo" };
  }
}
