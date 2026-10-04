"use server";

import { MarketOSRepository, state } from "@marketos/database";
import { PaymentStatus } from "@marketos/types";
import { revalidatePath } from "next/cache";

export async function reviewPaymentAction(
  tenantId: string,
  paymentId: string,
  status: PaymentStatus,
  rejectionReason?: string
) {
  try {
    const updated = await MarketOSRepository.reviewPayment(
      tenantId,
      paymentId,
      status,
      rejectionReason
    );
    revalidatePath("/");
    return { success: true, payment: updated };
  } catch (error) {
    console.error("Error reviewing payment:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al procesar el pago",
    };
  }
}

export async function adjustStockAction(
  tenantId: string,
  productId: string,
  delta: number
) {
  try {
    const prod = state.products.find(
      (p) => p.id === productId && p.tenant_id === tenantId
    );
    if (!prod) throw new Error("Producto no encontrado");

    prod.stock = Math.max(0, prod.stock + delta);
    revalidatePath("/");
    return { success: true, newStock: prod.stock };
  } catch (error) {
    console.error("Error adjusting stock:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al ajustar inventario",
    };
  }
}
