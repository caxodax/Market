"use server";

import {
  MarketOSRepository,
  CreateOrderInput,
  SubmitPaymentInput,
} from "@marketos/database";
import { revalidatePath } from "next/cache";

export async function createOrderAction(input: CreateOrderInput) {
  try {
    const order = await MarketOSRepository.createOrder(input);
    revalidatePath("/");
    return { success: true, order };
  } catch (error) {
    console.error("Error creating order:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al procesar el pedido",
    };
  }
}

export async function submitPaymentProofAction(input: SubmitPaymentInput) {
  try {
    const payment = await MarketOSRepository.submitPaymentProof(input);
    revalidatePath("/");
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
