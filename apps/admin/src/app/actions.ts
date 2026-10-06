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
    const order = state.orders.find((o) => o.id === orderId && o.tenant_id === tenantId);
    if (!order) throw new Error("Orden no encontrada");

    order.status = status;
    if (driverId) order.driver_id = driverId;
    order.updated_at = new Date().toISOString();

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
