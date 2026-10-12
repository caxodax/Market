"use client";

import React from "react";
import { Order, OrderStatus, TenantSettings, Driver } from "@marketos/types";
import { formatCurrency, generateOrderStatusNotificationWhatsAppLink } from "@marketos/utils";
import { BottomSheetModal } from "./bottom-sheet-modal";
import {
  X,
  Package,
  User,
  Phone,
  MapPin,
  Truck,
  Store,
  ExternalLink,
  MessageCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShoppingBag,
  Receipt,
  Tag,
  CreditCard,
  FileText,
} from "lucide-react";

interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  settings: TenantSettings;
  drivers?: Driver[];
  onUpdateStatus?: (orderId: string, newStatus: OrderStatus, driverId?: string) => Promise<void>;
  onReviewPayment?: (paymentId: string, status: "APPROVED" | "REJECTED") => Promise<void>;
  paymentId?: string;
  isProcessing?: boolean;
}

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; badgeClass: string; icon: React.ReactNode }
> = {
  CREATED: {
    label: "Iniciado",
    badgeClass: "bg-slate-500/10 text-slate-600 border-slate-500/20",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  PAYMENT_PENDING: {
    label: "Por Verificar Pago",
    badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    icon: <Clock className="w-3.5 h-3.5 text-amber-500" />,
  },
  PAYMENT_APPROVED: {
    label: "Pago Aprobado",
    badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
  },
  PREPARING: {
    label: "En Preparación",
    badgeClass: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
    icon: <Package className="w-3.5 h-3.5 text-indigo-500" />,
  },
  READY: {
    label: "Listo para Despacho",
    badgeClass: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    icon: <ShoppingBag className="w-3.5 h-3.5 text-blue-500" />,
  },
  DELIVERING: {
    label: "En Ruta",
    badgeClass: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    icon: <Truck className="w-3.5 h-3.5 text-orange-500" />,
  },
  COMPLETED: {
    label: "Entregado / Completado",
    badgeClass: "bg-emerald-600/15 text-emerald-700 border-emerald-600/30",
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
  },
  CANCELLED: {
    label: "Cancelado / Rechazado",
    badgeClass: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    icon: <AlertCircle className="w-3.5 h-3.5 text-rose-500" />,
  },
};

export function OrderDetailsModal({
  order,
  isOpen,
  onClose,
  settings,
  drivers = [],
  onUpdateStatus,
  onReviewPayment,
  paymentId,
  isProcessing = false,
}: OrderDetailsModalProps) {
  if (!isOpen || !order) return null;

  const statusInfo = STATUS_CONFIG[order.status] || {
    label: order.status,
    badgeClass: "bg-muted text-muted-foreground",
    icon: null,
  };

  const assignedDriver = drivers.find((d) => d.id === order.driver_id) || drivers[0];
  const items = order.items || [];
  const totalItemsCount = items.reduce((acc, it) => acc + it.quantity, 0);

  const formattedDate = new Date(order.created_at).toLocaleString("es-VE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const whatsappLink = generateOrderStatusNotificationWhatsAppLink({
    customerName: order.customer_name || "Cliente",
    customerPhone: order.customer_phone || settings.phone,
    businessName: settings.business_name,
    orderNumber: order.order_number,
    status: order.status,
    deliveryType: order.delivery_type,
    driverName: assignedDriver?.name,
    driverPhone: assignedDriver?.phone,
  });

  return (
    <BottomSheetModal
      isOpen={isOpen && !!order}
      onClose={onClose}
      maxWidth="max-w-2xl"
      bodyClassName="space-y-5"
      customHeader={
        <div className="flex items-start justify-between gap-3 border-b border-border p-5 sm:p-6 bg-muted/20 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono font-black text-lg sm:text-xl text-foreground">
                {order.order_number}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-xs font-black px-2.5 py-0.5 rounded-full border ${statusInfo.badgeClass}`}
              >
                {statusInfo.icon}
                <span>{statusInfo.label}</span>
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                {order.delivery_type === "DELIVERY" ? "🛵 Delivery" : "🏬 Retiro en Tienda"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Registrado el {formattedDate} {order.store_name && `• Sucursal: ${order.store_name}`}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] text-muted-foreground hover:text-foreground hover:bg-muted p-2 rounded-xl transition-colors cursor-pointer flex items-center justify-center shrink-0"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      }
    >

        {/* Datos del Cliente y Despacho */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Tarjeta Cliente */}
          <div className="bg-muted/40 p-3.5 rounded-2xl border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" />
                <span>Datos del Cliente</span>
              </span>
              {order.customer_phone && (
                <a
                  href={`tel:${order.customer_phone}`}
                  className="text-primary hover:underline font-semibold flex items-center gap-1 text-[11px]"
                >
                  <Phone className="w-3 h-3" />
                  <span>Llamar</span>
                </a>
              )}
            </div>
            <p className="font-extrabold text-sm text-foreground">
              {order.customer_name || "Cliente General"}
            </p>
            <p className="font-mono text-muted-foreground">
              {order.customer_phone || "Teléfono no registrado"}
            </p>
            {order.customer_email && (
              <p className="text-muted-foreground truncate">{order.customer_email}</p>
            )}
          </div>

          {/* Tarjeta Dirección / Modalidad */}
          <div className="bg-muted/40 p-3.5 rounded-2xl border border-border space-y-1.5">
            <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1.5">
              {order.delivery_type === "DELIVERY" ? (
                <Truck className="w-3.5 h-3.5 text-primary" />
              ) : (
                <Store className="w-3.5 h-3.5 text-primary" />
              )}
              <span>Modalidad de Entrega</span>
            </span>
            <p className="font-extrabold text-sm text-foreground">
              {order.delivery_type === "DELIVERY" ? "Envío a Domicilio" : "Retiro en Sucursal"}
            </p>
            {order.delivery_address ? (
              <p className="text-muted-foreground leading-relaxed flex items-start gap-1">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <span>{order.delivery_address}</span>
              </p>
            ) : (
              <p className="text-muted-foreground">
                Retiro presencial en mostrador de la tienda.
              </p>
            )}
          </div>
        </div>

        {/* Desglose de Productos Llevados ("Lo que se han llevado") */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-primary" />
              <span>Productos del Pedido ({totalItemsCount} {totalItemsCount === 1 ? "artículo" : "artículos"})</span>
            </h4>
          </div>

          {items.length === 0 ? (
            <div className="p-4 rounded-2xl bg-muted/30 border border-dashed border-border text-center text-xs text-muted-foreground">
              Sin artículos detallados guardados en este pedido.
            </div>
          ) : (
            <div className="divide-y divide-border border border-border rounded-2xl overflow-hidden bg-card">
              {items.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="p-3 sm:px-4 flex items-center justify-between gap-3 text-xs hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary font-black text-xs flex items-center justify-center shrink-0">
                      {item.quantity}x
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate">
                        {item.product_name}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {formatCurrency(item.unit_price_usd, "USD")} c/u
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-black text-foreground">
                      {formatCurrency(item.total_price_usd, "USD")}
                    </span>
                    <span className="block text-[10px] text-muted-foreground font-mono">
                      Bs. {(item.total_price_usd * order.exchange_rate_applied).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resumen Financiero y Método de Pago */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Información de Pago Reportada */}
          <div className="bg-muted/40 p-3.5 rounded-2xl border border-border space-y-2">
            <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-primary" />
              <span>Detalles del Pago</span>
            </span>

            <div className="space-y-1">
              <p>
                <strong>Método:</strong>{" "}
                <span className="font-semibold text-foreground">
                  {order.payment_method || "No especificado"}
                </span>
              </p>
              {order.payment_reference && (
                <p>
                  <strong>Referencia:</strong>{" "}
                  <span className="font-mono font-bold text-foreground">
                    {order.payment_reference}
                  </span>
                </p>
              )}
              {order.payment_status && (
                <p className="flex items-center gap-1.5 pt-0.5">
                  <strong>Estado Pago:</strong>
                  <span
                    className={`font-black text-[10px] px-2 py-0.5 rounded-full border ${
                      order.payment_status === "APPROVED"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        : order.payment_status === "REJECTED"
                        ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                        : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                    }`}
                  >
                    {order.payment_status}
                  </span>
                </p>
              )}
            </div>

            {order.proof_image_url && (
              <div className="pt-1">
                <a
                  href={order.proof_image_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline bg-primary/10 px-2.5 py-1 rounded-lg"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Ver Comprobante Adjunto</span>
                </a>
              </div>
            )}
          </div>

          {/* Desglose de Totales */}
          <div className="bg-muted/40 p-3.5 rounded-2xl border border-border space-y-1.5">
            <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-primary" />
              <span>Totales del Pedido</span>
            </span>

            <div className="space-y-1 pt-1">
              {order.discount_usd && order.discount_usd > 0 ? (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    <span>Descuento Cupón:</span>
                  </span>
                  <span>-{formatCurrency(order.discount_usd, "USD")}</span>
                </div>
              ) : null}

              {order.delivery_fee_usd && order.delivery_fee_usd > 0 ? (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tarifa Delivery:</span>
                  <span>{formatCurrency(order.delivery_fee_usd, "USD")}</span>
                </div>
              ) : null}

              <div className="border-t border-border pt-1.5 mt-1 flex justify-between items-baseline">
                <span className="font-black text-sm text-foreground">Total USD:</span>
                <span className="font-black text-base text-primary">
                  {formatCurrency(order.total_usd, "USD")}
                </span>
              </div>

              <div className="flex justify-between text-muted-foreground text-[11px] font-mono">
                <span>Total en Bolívares:</span>
                <span className="font-bold text-foreground">
                  Bs. {order.total_ves.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="text-[10px] text-muted-foreground text-right pt-0.5">
                Tasa aplicada: Bs. {order.exchange_rate_applied.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Notas adicionales si existen */}
        {order.notes && (
          <div className="p-3 rounded-xl bg-muted/30 border border-border text-xs text-muted-foreground space-y-0.5">
            <span className="font-bold text-foreground flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-primary" />
              <span>Notas del Pedido:</span>
            </span>
            <p className="leading-relaxed">{order.notes}</p>
          </div>
        )}

        {/* Acciones de Operación y Transición de Estados */}
        <div className="pt-2 border-t border-border space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Contactar por WhatsApp */}
            <a
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 text-xs font-bold border border-emerald-500/20 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Enviar Estado por WhatsApp</span>
            </a>

            {/* Botones de flujo operativo */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Aprobar Pago si está pendiente */}
              {onReviewPayment && paymentId && order.status === "PAYMENT_PENDING" && (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => onReviewPayment(paymentId, "APPROVED")}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Aprobar Pago</span>
                </button>
              )}

              {onUpdateStatus && order.status === "PREPARING" && (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => onUpdateStatus(order.id, "READY")}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Marcar Listo para Despacho</span>
                </button>
              )}

              {onUpdateStatus && order.status === "READY" && (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => onUpdateStatus(order.id, "DELIVERING", assignedDriver?.id)}
                  className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Enviar a Ruta</span>
                </button>
              )}

              {onUpdateStatus && order.status === "DELIVERING" && (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => onUpdateStatus(order.id, "COMPLETED")}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirmar Entrega</span>
                </button>
              )}

              {onUpdateStatus && order.status !== "COMPLETED" && order.status !== "CANCELLED" && (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => {
                    if (window.confirm("¿Seguro que deseas cancelar este pedido?")) {
                      onUpdateStatus(order.id, "CANCELLED");
                    }
                  }}
                  className="px-3 py-2 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar Pedido
                </button>
              )}
            </div>
          </div>
        </div>
    </BottomSheetModal>
  );
}
