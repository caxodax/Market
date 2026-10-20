"use client";

import React, { useState } from "react";
import { Order, OrderStatus, TenantSettings, Driver, TenantModuleId } from "@marketos/types";
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
  Copy,
  Check,
  ZoomIn,
  ShieldCheck,
  Download,
  Printer,
  Hash,
} from "lucide-react";
import { registerPhysicalFiscalInvoiceAction } from "../app/actions";

interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  settings: TenantSettings;
  drivers?: Driver[];
  activeModuleIds?: TenantModuleId[];
  onUpdateStatus?: (orderId: string, newStatus: OrderStatus, driverId?: string) => Promise<void>;
  onReviewPayment?: (paymentId: string, status: "APPROVED" | "REJECTED") => Promise<void>;
  onOrderUpdated?: (order: Order) => void;
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
  activeModuleIds = [],
  onUpdateStatus,
  onReviewPayment,
  paymentId,
  isProcessing = false,
  onOrderUpdated,
}: OrderDetailsModalProps) {
  const isVenezuelaActive = activeModuleIds.includes("local_venezuela");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [physicalInvoiceInput, setPhysicalInvoiceInput] = useState(order?.physical_invoice_number || "");
  const [physicalSerialInput, setPhysicalSerialInput] = useState(
    order?.physical_machine_serial || settings.billing_settings?.fiscal_machine_serial || ""
  );
  const [isRegisteringFiscal, setIsRegisteringFiscal] = useState(false);
  const [fiscalSuccessMsg, setFiscalSuccessMsg] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const handleRegisterPhysicalInvoice = async () => {
    if (!physicalInvoiceInput.trim()) return;
    setIsRegisteringFiscal(true);
    setFiscalSuccessMsg(null);
    try {
      const res = await registerPhysicalFiscalInvoiceAction(
        order.tenant_id,
        order.id,
        physicalInvoiceInput.trim(),
        physicalSerialInput.trim() || undefined
      );
      if (res.success && res.order) {
        setFiscalSuccessMsg(`Factura fiscal #${physicalInvoiceInput.trim()} vinculada exitosamente.`);
        if (onOrderUpdated) {
          onOrderUpdated(res.order);
        }
      } else {
        alert(res.error || "No se pudo vincular la factura fiscal física.");
      }
    } catch (e: any) {
      alert(e.message || "Error al vincular factura fiscal.");
    } finally {
      setIsRegisteringFiscal(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

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
    <>
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
                {order.is_fiscal_invoice ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    <Receipt className="w-3 h-3" />
                    <span>Factura: {order.fiscal_invoice_number} (Ctrl: {order.fiscal_control_number})</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                    <span>Ticket Preventa</span>
                  </span>
                )}
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
          {/* Tarjeta Cliente con Cédula destacada */}
          <div className="bg-muted/40 p-3.5 rounded-2xl border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" />
                <span>Datos del Cliente</span>
              </span>
              {order.customer_phone && (
                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${order.customer_phone}`}
                    className="text-primary hover:underline font-semibold flex items-center gap-1 text-[11px]"
                  >
                    <Phone className="w-3 h-3" />
                    <span>Llamar</span>
                  </a>
                  <a
                    href={`https://wa.me/${order.customer_phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-600 hover:underline font-semibold flex items-center gap-1 text-[11px]"
                  >
                    <MessageCircle className="w-3 h-3" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              )}
            </div>

            <p className="font-extrabold text-sm text-foreground">
              {order.customer_name || "Cliente General"}
            </p>

            {/* Cédula o RIF destacado para verificación física */}
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-[11px] font-semibold text-muted-foreground">Cédula / RIF:</span>
              {order.customer_id_number ? (
                <div className="flex items-center gap-1">
                  <span className="font-mono font-black text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>{order.customer_id_number}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(order.customer_id_number!, "ci")}
                    className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Copiar Cédula"
                  >
                    {copiedField === "ci" ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              ) : (
                <span className="text-muted-foreground font-italic">No registrada</span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground">Teléfono:</span>
              <span className="font-mono text-foreground font-semibold">
                {order.customer_phone || "No registrado"}
              </span>
              {order.customer_phone && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(order.customer_phone!, "phone")}
                  className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Copiar Teléfono"
                >
                  {copiedField === "phone" ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>

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

            {/* Repartidor asignado si es delivery */}
            {order.delivery_type === "DELIVERY" && drivers.length > 0 && (
              <div className="pt-1.5 border-t border-border flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Repartidor Asignado:</span>
                <span className="font-semibold text-foreground">
                  {assignedDriver ? assignedDriver.name : "Sin asignar"}
                </span>
              </div>
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
                    {isVenezuelaActive && (
                      <span className="block text-[10px] text-muted-foreground font-mono">
                        Bs. {(item.total_price_usd * order.exchange_rate_applied).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resumen Financiero y VERIFICACIÓN DE PAGO (Inspector de Comprobante) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Tarjeta de Verificación del Pago & Comprobante Adjunto */}
          <div className="bg-muted/40 p-3.5 rounded-2xl border border-border space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-primary" />
                <span>Auditoría de Pago</span>
              </span>
              {order.payment_status && (
                <span
                  className={`font-black text-[10px] px-2 py-0.5 rounded-full border ${
                    order.payment_status === "APPROVED"
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : order.payment_status === "REJECTED"
                      ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                      : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                  }`}
                >
                  {order.payment_status === "APPROVED"
                    ? "PAGO VERIFICADO"
                    : order.payment_status === "REJECTED"
                    ? "PAGO RECHAZADO"
                    : "POR VERIFICAR"}
                </span>
              )}
            </div>

            <div className="space-y-1 text-xs">
              <p>
                <strong>Método:</strong>{" "}
                <span className="font-semibold text-foreground">
                  {order.payment_method || "No especificado"}
                </span>
              </p>
              {order.payment_reference && (
                <div className="flex items-center gap-1.5">
                  <strong>Referencia:</strong>
                  <span className="font-mono font-black text-foreground bg-background px-2 py-0.5 rounded border border-border">
                    {order.payment_reference}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(order.payment_reference!, "ref")}
                    className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Copiar referencia bancaria"
                  >
                    {copiedField === "ref" ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* INSPECTOR VISUAL DEL COMPROBANTE ADJUNTO */}
            <div className="pt-1 border-t border-border/80">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block mb-1.5">
                Comprobante Visual Adjunto
              </span>

              {order.proof_image_url ? (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div
                    onClick={() => setIsLightboxOpen(true)}
                    className="relative cursor-pointer aspect-video bg-muted/60 flex items-center justify-center overflow-hidden group"
                  >
                    <img
                      src={order.proof_image_url}
                      alt="Comprobante de Pago Adjunto"
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white font-bold text-xs">
                      <ZoomIn className="w-4 h-4" />
                      <span>Inspeccionar Comprobante</span>
                    </div>
                  </div>

                  <div className="p-2 bg-muted/20 border-t border-border flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Adjunto subido por cliente</span>
                    <button
                      type="button"
                      onClick={() => setIsLightboxOpen(true)}
                      className="inline-flex items-center gap-1 text-primary hover:underline font-bold cursor-pointer"
                    >
                      <ZoomIn className="w-3 h-3" />
                      <span>Ver en Grande</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-[11px]">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Sin imagen de captura adjunta</span>
                  </div>
                  <p className="text-[10px] opacity-90 leading-tight">
                    El cliente no subió imagen o reportó pago en efectivo. Valida la referencia bancaria en tu estado de cuenta.
                  </p>
                </div>
              )}
            </div>
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

              {isVenezuelaActive && (
                <>
                  <div className="flex justify-between text-muted-foreground text-[11px] font-mono">
                    <span>Total en Bolívares:</span>
                    <span className="font-bold text-foreground">
                      Bs. {order.total_ves.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="text-[10px] text-muted-foreground text-right pt-0.5">
                    Tasa aplicada: Bs. {order.exchange_rate_applied.toFixed(2)}
                  </div>
                </>
              )}
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

        {/* Control Fiscal SENIAT (Caja Mostrador / Facturación) */}
        {isVenezuelaActive && (
          <div className="p-3.5 rounded-2xl bg-card border border-border shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-primary" />
                <span>Control Fiscal SENIAT (Mostrador / Caja)</span>
              </span>
              {order.physical_invoice_number ? (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  Facturado en Caja
                </span>
              ) : order.is_fiscal_invoice ? (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  Factura Digital
                </span>
              ) : (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                  Preventa / Pendiente Caja
                </span>
              )}
            </div>

            {order.physical_invoice_number ? (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                <div className="flex items-center justify-between font-mono font-bold">
                  <span>Factura Fiscal Física N° {order.physical_invoice_number}</span>
                  {order.physical_machine_serial && (
                    <span>MF: {order.physical_machine_serial}</span>
                  )}
                </div>
                {order.physical_fiscal_registered_at && (
                  <p className="text-[10px] opacity-80">
                    Registrado en caja el: {new Date(order.physical_fiscal_registered_at).toLocaleString("es-VE")}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                {/* Divisas IGTF reminder if payment was foreign currency */}
                {(order.payment_method === "CASH_USD" || order.payment_method === "ZELLE") &&
                  settings.billing_settings?.apply_igtf && (
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300">
                      <strong>💡 Recordatorio para Máquina Fiscal:</strong> Pago en divisas sujeto a IGTF 3%:{" "}
                      <span className="font-mono font-bold">${order.total_usd.toFixed(2)} (Bs. {order.total_ves.toFixed(2)})</span>. Registrar en registradora bajo concepto Divisas.
                    </div>
                  )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      N° Factura Fiscal (de la registradora)
                    </label>
                    <input
                      type="text"
                      value={physicalInvoiceInput}
                      onChange={(e) => setPhysicalInvoiceInput(e.target.value.toUpperCase())}
                      placeholder="ej. 0004521"
                      className="w-full h-9 px-3 rounded-xl border border-input bg-background text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Serial Máquina Fiscal
                    </label>
                    <input
                      type="text"
                      value={physicalSerialInput}
                      onChange={(e) => setPhysicalSerialInput(e.target.value.toUpperCase())}
                      placeholder="ej. Z4A1234567"
                      className="w-full h-9 px-3 rounded-xl border border-input bg-background text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <p className="text-[10px] text-muted-foreground">
                    Vincula el ticket de la registradora física para el Libro de Ventas.
                  </p>
                  <button
                    type="button"
                    onClick={handleRegisterPhysicalInvoice}
                    disabled={isRegisteringFiscal || !physicalInvoiceInput.trim()}
                    className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:bg-primary/90 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isRegisteringFiscal ? "Registrando..." : "Vincular Factura"}
                  </button>
                </div>

                {fiscalSuccessMsg && (
                  <p className="text-[11px] text-emerald-600 font-bold mt-1">
                    ✓ {fiscalSuccessMsg}
                  </p>
                )}
              </div>
            )}
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
              {/* Aprobar / Rechazar Pago si está pendiente */}
              {order.status === "PAYMENT_PENDING" && (
                <>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => {
                      if (onReviewPayment && paymentId) {
                        onReviewPayment(paymentId, "APPROVED");
                      } else if (onUpdateStatus) {
                        onUpdateStatus(order.id, "PREPARING");
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Aprobar Pago</span>
                  </button>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => {
                      if (window.confirm("¿Seguro que deseas rechazar este pago? El pedido quedará cancelado.")) {
                        if (onReviewPayment && paymentId) {
                          onReviewPayment(paymentId, "REJECTED");
                        } else if (onUpdateStatus) {
                          onUpdateStatus(order.id, "CANCELLED");
                        }
                      }
                    }}
                    className="px-3 py-2 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                </>
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

              {onUpdateStatus &&
                order.status !== "COMPLETED" &&
                order.status !== "CANCELLED" &&
                order.status !== "PAYMENT_PENDING" && (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => {
                      if (window.confirm("¿Seguro que deseas cancelar este pedido?")) {
                        onUpdateStatus(order.id, "CANCELLED");
                      }
                    }}
                    className="px-3 py-2 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    Cancelar Pedido
                  </button>
                )}
            </div>
          </div>
        </div>
      </BottomSheetModal>

      {/* Lightbox / Zoom Modal for Attached Payment Proof */}
      {isLightboxOpen && order.proof_image_url && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="relative max-w-4xl max-h-[95vh] w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header toolbar */}
            <div className="w-full flex items-center justify-between gap-3 p-3.5 bg-slate-900/90 rounded-t-2xl border border-white/10 text-white text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-bold text-emerald-400">Comprobante de Pago</span>
                <span className="font-mono text-slate-400 truncate">#{order.order_number}</span>
                {order.payment_reference && (
                  <span className="font-mono bg-white/10 px-2 py-0.5 rounded text-[11px] text-white shrink-0">
                    Ref: {order.payment_reference}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={order.proof_image_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-1 font-semibold text-[11px]"
                  title="Abrir imagen en nueva pestaña"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Abrir original</span>
                </a>
                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(false)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  title="Cerrar vista previa"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* High-res Image Preview */}
            <div className="w-full overflow-auto max-h-[82vh] bg-slate-950 p-2 sm:p-4 rounded-b-2xl border-x border-b border-white/10 flex items-center justify-center">
              <img
                src={order.proof_image_url}
                alt="Comprobante de Pago en alta resolución"
                className="max-h-[76vh] w-auto max-w-full object-contain rounded-lg shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
