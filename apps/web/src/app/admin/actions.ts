"use server";

import { MarketOSRepository } from "@marketos/database";
import {
  PaymentStatus,
  CreateProductInput,
  UpdateProductInput,
  InviteStaffInput,
  UserRole,
  TenantSettings,
  CreateCouponInput,
  UpdateCouponInput,
  Coupon,
  Store,
  DeliveryZone,
  Driver,
  CreateDeliveryZoneInput,
  UpdateDeliveryZoneInput,
  CreateDriverInput,
  UpdateDriverInput,
} from "@marketos/types";
import { revalidatePath } from "next/cache";
import { sendOrderStatusPushNotification } from "@/lib/pushNotifications";
import {
  invalidateProductsCache,
  invalidateSettingsCache,
  invalidateExchangeRateCache,
  invalidateDeliveryZonesCache,
} from "@/lib/cached-queries";

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

    // Enviar notificación push al cliente si tiene alertas activas en su dispositivo
    if (updated) {
      try {
        const orders = await MarketOSRepository.getTenantOrders(tenantId);
        const relatedOrder = orders.find((o) => o.id === updated.order_id);
        const settings = await MarketOSRepository.getTenantSettings(tenantId);
        if (relatedOrder) {
          await sendOrderStatusPushNotification({
            tenantId,
            orderNumber: relatedOrder.order_number,
            status,
            customerId: relatedOrder.customer_id,
            customerPhone: relatedOrder.customer_phone,
            storeName: settings.business_name,
            rejectionReason,
          });
        }
      } catch (pushErr) {
        console.warn("[MarketOS Push] No se pudo despachar push de pago:", pushErr);
      }
    }

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
    invalidateProductsCache(tenantId);
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
    invalidateExchangeRateCache(tenantId);
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

    // Enviar notificación push al cliente si tiene alertas activas en su dispositivo
    try {
      const settings = await MarketOSRepository.getTenantSettings(tenantId);
      let driverName: string | undefined = undefined;
      if (driverId) {
        const drivers = await MarketOSRepository.getDrivers(tenantId);
        driverName = drivers.find((d) => d.id === driverId)?.name;
      }
      await sendOrderStatusPushNotification({
        tenantId,
        orderNumber: order.order_number,
        status,
        customerId: order.customer_id,
        customerPhone: order.customer_phone,
        storeName: settings.business_name,
        driverName,
      });
    } catch (pushErr) {
      console.warn("[MarketOS Push] No se pudo despachar push de pedido:", pushErr);
    }

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

/**
 * Upload store logo permanently to Cloudflare R2
 */
export async function uploadStoreLogoAction(formData: FormData) {
  try {
    const file = formData.get("file") as File | null;
    const tenantId = (formData.get("tenantId") as string) || "shop-market-ca";

    if (!file || file.size === 0) {
      return { success: false, error: "No se seleccionó ninguna imagen de logo" };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { uploadToR2 } = await import("@marketos/utils");
    const res = await uploadToR2({
      tenantId,
      folder: "branding",
      fileName: file.name || "logo.webp",
      body: buffer,
      contentType: file.type || "image/webp",
    });

    return { success: true, url: res.url, key: res.key };
  } catch (error) {
    console.error("Error uploading store logo to R2:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al subir logo a Cloudflare R2",
    };
  }
}

export async function createProductAction(input: CreateProductInput) {
  try {
    const product = await MarketOSRepository.createProduct(input);
    invalidateProductsCache(input.tenantId);
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
    invalidateProductsCache(input.tenantId);
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
    invalidateProductsCache(tenantId);
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
    invalidateExchangeRateCache(tenantId);
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
    invalidateSettingsCache(tenantId);
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

/**
 * Create a new store / sucursal for tenant
 */
export async function createStoreAction(input: {
  tenantId: string;
  name: string;
  code?: string;
  address?: string;
  phone?: string;
  isActive?: boolean;
}) {
  try {
    const store = await MarketOSRepository.createStore(input);
    revalidatePath("/admin");
    revalidatePath("/platform");
    return { success: true, store };
  } catch (error) {
    console.error("Error creating store:", error);
    return { success: false, error: "No se pudo crear la sucursal" };
  }
}

/**
 * Update an existing store / sucursal
 */
export async function updateStoreAction(
  storeId: string,
  updates: Partial<Store>
) {
  try {
    const store = await MarketOSRepository.updateStore(storeId, updates);
    revalidatePath("/admin");
    revalidatePath("/platform");
    return { success: true, store };
  } catch (error) {
    console.error("Error updating store:", error);
    return { success: false, error: "No se pudo actualizar la sucursal" };
  }
}

/**
 * Update tenant custom domain (e.g. 'tiendasanpedro.com' or null)
 */
export async function updateTenantCustomDomainAction(
  tenantId: string,
  rawDomain: string | null
) {
  try {
    let cleanDomain: string | null = null;
    if (rawDomain && rawDomain.trim()) {
      cleanDomain = rawDomain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "")
        .replace(/:\d+$/, "")
        .trim();
    }

    const settings = await MarketOSRepository.updateTenantSettings(tenantId, {
      custom_domain: cleanDomain,
    });

    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/platform");

    return { success: true, customDomain: cleanDomain, settings };
  } catch (error: any) {
    console.error("Error updating custom domain:", error);
    return {
      success: false,
      error: error.message || "No se pudo vincular el dominio personalizado",
    };
  }
}

/**
 * Create a new delivery zone
 */
export async function createDeliveryZoneAction(input: CreateDeliveryZoneInput) {
  try {
    const zone = await MarketOSRepository.createDeliveryZone(input);
    invalidateDeliveryZonesCache(input.tenantId);
    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true, zone };
  } catch (error: any) {
    console.error("Error creating delivery zone:", error);
    return {
      success: false,
      error: error.message || "Error al crear la zona de delivery",
    };
  }
}

/**
 * Update an existing delivery zone
 */
export async function updateDeliveryZoneAction(input: UpdateDeliveryZoneInput) {
  try {
    const zone = await MarketOSRepository.updateDeliveryZone(input);
    invalidateDeliveryZonesCache(input.tenantId);
    revalidatePath("/admin");
    revalidatePath("/");
    return { success: !!zone, zone };
  } catch (error: any) {
    console.error("Error updating delivery zone:", error);
    return {
      success: false,
      error: error.message || "Error al actualizar la zona de delivery",
    };
  }
}

/**
 * Soft delete (deactivate) or reactivate a delivery zone
 */
export async function toggleDeliveryZoneStatusAction(
  tenantId: string,
  zoneId: string,
  isActive: boolean
) {
  try {
    const success = await MarketOSRepository.toggleDeliveryZoneStatus(
      tenantId,
      zoneId,
      isActive
    );
    invalidateDeliveryZonesCache(tenantId);
    revalidatePath("/admin");
    revalidatePath("/");
    return { success };
  } catch (error: any) {
    console.error("Error toggling delivery zone status:", error);
    return {
      success: false,
      error: error.message || "Error al cambiar estado de la zona",
    };
  }
}

/**
 * Create a new delivery driver
 */
export async function createDriverAction(input: CreateDriverInput) {
  try {
    const driver = await MarketOSRepository.createDriver(input);
    revalidatePath("/admin");
    return { success: true, driver };
  } catch (error: any) {
    console.error("Error creating driver:", error);
    return {
      success: false,
      error: error.message || "Error al registrar el repartidor",
    };
  }
}

/**
 * Update an existing driver
 */
export async function updateDriverAction(input: UpdateDriverInput) {
  try {
    const driver = await MarketOSRepository.updateDriver(input);
    revalidatePath("/admin");
    return { success: !!driver, driver };
  } catch (error: any) {
    console.error("Error updating driver:", error);
    return {
      success: false,
      error: error.message || "Error al actualizar el repartidor",
    };
  }
}

/**
 * Soft delete (deactivate) or reactivate a driver
 */
export async function toggleDriverStatusAction(
  tenantId: string,
  driverId: string,
  isActive: boolean
) {
  try {
    const success = await MarketOSRepository.toggleDriverStatus(
      tenantId,
      driverId,
      isActive
    );
    revalidatePath("/admin");
    return { success };
  } catch (error: any) {
    console.error("Error toggling driver status:", error);
    return {
      success: false,
      error: error.message || "Error al cambiar estado del repartidor",
    };
  }
}
