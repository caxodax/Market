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
  delta: number,
  storeId?: string
) {
  try {
    const newStock = await MarketOSRepository.adjustStock(
      tenantId,
      productId,
      delta,
      storeId
    );
    revalidatePath("/");
    return { success: true, newStock };
  } catch (error) {
    console.error("Error adjusting stock:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al ajustar inventario",
    };
  }
}

/**
 * Synchronize BCV official exchange rate from API into Database
 */
export async function syncBcvRateAction(tenantId: string) {
  try {
    const updatedRate = await MarketOSRepository.syncBcvRateFromApi(tenantId);
    revalidatePath("/");
    return { success: true, rate: updatedRate };
  } catch (error) {
    console.error("Error syncing BCV rate:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al sincronizar tasa BCV",
    };
  }
}

/**
 * Update Order delivery/preparation status and assign driver
 */
export async function updateOrderStatusAction(
  tenantId: string,
  orderId: string,
  status: any,
  driverId?: string
) {
  try {
    const order = await MarketOSRepository.updateOrderStatus(
      tenantId,
      orderId,
      status,
      driverId
    );
    if (!order) throw new Error("Orden no encontrada");

    revalidatePath("/");
    return { success: true, order };
  } catch (error) {
    console.error("Error updating order status:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al actualizar estado del pedido",
    };
  }
}
