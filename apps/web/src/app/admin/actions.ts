"use server";

import { MarketOSRepository } from "@marketos/database";
import { PaymentStatus, CreateProductInput, UpdateProductInput, InviteStaffInput, UserRole, TenantSettings, CreateCouponInput, UpdateCouponInput, Coupon } from "@marketos/types";
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
    revalidatePath("/admin");
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
    revalidatePath("/admin");
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
    revalidatePath("/admin");
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

    revalidatePath("/admin");
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

/**
 * Upload product image to Cloudflare R2
 */
export async function uploadProductImageAction(formData: FormData) {
  try {
    const file = formData.get("file") as File | null;
    const tenantId = (formData.get("tenantId") as string) || "shop-market-ca";

    if (!file || file.size === 0) {
      return { success: false, error: "No se seleccionó ninguna imagen" };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { uploadToR2 } = await import("@marketos/utils");
    const res = await uploadToR2({
      tenantId,
      folder: "products",
      fileName: file.name || "producto.webp",
      body: buffer,
      contentType: file.type || "image/webp",
    });

    return { success: true, url: res.url, key: res.key };
  } catch (error) {
    console.error("Error uploading product image to R2:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al subir imagen a Cloudflare R2",
    };
  }
}

export async function createProductAction(input: CreateProductInput) {
  try {
    const product = await MarketOSRepository.createProduct(input);
    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true, product };
  } catch (error) {
    console.error("Error creating product:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al crear producto",
    };
  }
}

export async function updateProductAction(input: UpdateProductInput) {
  try {
    const product = await MarketOSRepository.updateProduct(input);
    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true, product };
  } catch (error) {
    console.error("Error updating product:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al actualizar producto",
    };
  }
}

export async function deleteProductAction(tenantId: string, productId: string) {
  try {
    const ok = await MarketOSRepository.deleteProduct(tenantId, productId);
    revalidatePath("/admin");
    revalidatePath("/");
    return { success: ok };
  } catch (error) {
    console.error("Error deleting product:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al eliminar producto",
    };
  }
}

export async function inviteStaffMemberAction(input: InviteStaffInput) {
  try {
    const profile = await MarketOSRepository.inviteStaffMember(input);
    revalidatePath("/admin");
    return { success: true, profile };
  } catch (error) {
    console.error("Error inviting staff:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al asignar colaborador",
    };
  }
}

export async function updateStaffRoleAction(
  tenantId: string,
  profileId: string,
  role: UserRole
) {
  try {
    const profile = await MarketOSRepository.updateStaffRole(tenantId, profileId, role);
    revalidatePath("/admin");
    return { success: true, profile };
  } catch (error) {
    console.error("Error updating staff role:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al actualizar rol",
    };
  }
}

/**
 * Save manual contingency exchange rate (USD, EUR, USDT)
 */
export async function saveManualRateAction(
  tenantId: string,
  data: {
    date_rate: string;
    usd_rate: number;
    eur_rate?: number;
    usdt_rate?: number;
  }
) {
  try {
    const updatedRate = await MarketOSRepository.saveManualExchangeRate(tenantId, {
      date_rate: data.date_rate,
      usd_rate: data.usd_rate,
      eur_rate: data.eur_rate,
      usdt_rate: data.usdt_rate,
      source: "MANUAL",
    });
    revalidatePath("/admin");
    revalidatePath("/platform");
    revalidatePath("/");
    return { success: true, rate: updatedRate };
  } catch (error) {
    console.error("Error saving manual rate:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al guardar tasa manual",
    };
  }
}

/**
 * Update Tenant Settings, Branding and Payment Methods
 */
export async function updateTenantSettingsAction(
  tenantId: string,
  updates: Partial<TenantSettings>
) {
  try {
    const settings = await MarketOSRepository.updateTenantSettings(tenantId, updates);
    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true, settings };
  } catch (error) {
    console.error("Error updating tenant settings:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al guardar la configuración",
    };
  }
}

/**
 * Create a new Discount Coupon with amount and expiration date
 */
export async function createCouponAction(input: CreateCouponInput) {
  try {
    const coupon = await MarketOSRepository.createCoupon(input);
    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true, coupon };
  } catch (error) {
    console.error("Error creating coupon:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al crear el cupón",
    };
  }
}

/**
 * Toggle Coupon active/inactive
 */
export async function toggleCouponAction(
  tenantId: string,
  couponId: string,
  isActive: boolean
) {
  try {
    const updated = await MarketOSRepository.toggleCoupon(tenantId, couponId, isActive);
    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true, coupon: updated };
  } catch (error) {
    console.error("Error toggling coupon:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al actualizar estado del cupón",
    };
  }
}

/**
 * Delete a Coupon
 */
export async function deleteCouponAction(tenantId: string, couponId: string) {
  try {
    await MarketOSRepository.deleteCoupon(tenantId, couponId);
    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting coupon:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al eliminar el cupón",
    };
  }
}

/**
 * Update an existing Coupon
 */
export async function updateCouponAction(input: UpdateCouponInput) {
  try {
    const updated = await MarketOSRepository.updateCoupon(input);
    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true, coupon: updated };
  } catch (error) {
    console.error("Error updating coupon:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al actualizar el cupón",
    };
  }
}

/**
 * Fetch latest enriched orders for tenant dashboard
 */
export async function getLatestOrdersAction(tenantId: string) {
  try {
    const orders = await MarketOSRepository.getTenantOrders(tenantId);
    return { success: true, orders };
  } catch (error) {
    console.error("Error fetching latest orders:", error);
    return { success: false, orders: [] };
  }
}

/**
 * Fetch latest payments for tenant dashboard
 */
export async function getLatestPaymentsAction(tenantId: string) {
  try {
    const payments = await MarketOSRepository.getTenantPayments(tenantId);
    return { success: true, payments };
  } catch (error) {
    console.error("Error fetching latest payments:", error);
    return { success: false, payments: [] };
  }
}

/**
 * Fetch Sales & Financial Analytics for tenant reports
 */
export async function getSalesAnalyticsAction(
  tenantId: string,
  dateRange: "today" | "week" | "month" | "all" = "all"
) {
  try {
    const report = await MarketOSRepository.getSalesAnalytics(tenantId, { dateRange });
    return { success: true, report };
  } catch (error) {
    console.error("Error fetching sales analytics:", error);
    return { success: false, error: "No se pudieron calcular las métricas de ventas" };
  }
}
