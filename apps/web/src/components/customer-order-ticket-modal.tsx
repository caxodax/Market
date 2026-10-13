"use client";

import React, { useState } from "react";
import { Order, OrderStatus, TenantSettings, Store } from "@marketos/types";
import { formatCurrency, generateCustomerOrderWhatsAppLink } from "@marketos/utils";
import { BottomSheetModal } from "./bottom-sheet-modal";
import {
  X,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Package,
  Truck,
  Store as StoreIcon,
  MapPin,
  Calendar,
  MessageCircle,
  Printer,
  Copy,
  Check,
  QrCode,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

interface CustomerOrderTicketModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  settings: TenantSettings;
  store?: Store;
}

interface StepInfo {
  id: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
}

export function CustomerOrderTicketModal({
  order,
  isOpen,
  onClose,
  settings,
  store,
}: CustomerOrderTicketModalProps) {
  const [copiedOrder, setCopiedOrder] = useState(false);
  const [copiedCi, setCopiedCi] = useState(false);

  if (!isOpen || !order) return null;

  const handleCopyOrderNumber = () => {
    navigator.clipboard.writeText(order.order_number);
    setCopiedOrder(true);
    setTimeout(() => setCopiedOrder(false), 2000);
  };

  const handleCopyCi = () => {
    if (order.customer_id_number) {
      navigator.clipboard.writeText(order.customer_id_number);
      setCopiedCi(true);
      setTimeout(() => setCopiedCi(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const whatsappUrl = generateCustomerOrderWhatsAppLink({
    tenantPhone: settings.whatsapp_number || settings.phone,
    businessName: settings.business_name,
    order,
  });

  const formattedDate = new Date(order.created_at).toLocaleString("es-VE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  // Calculate current progress step (1 to 5)
  const getStepStatus = (status: OrderStatus): number => {
    switch (status) {
      case "CREATED":
        return 1;
      case "PAYMENT_PENDING":
        return 1;
      case "PAYMENT_APPROVED":
        return 2;
      case "PREPARING":
        return 3;
      case "READY":
        return 4;
      case "DELIVERING":
        return 4;
      case "COMPLETED":
        return 5;
      case "CANCELLED":
        return -1;
      default:
        return 1;
    }
  };

  const currentStep = getStepStatus(order.status);
  const isPickup = order.delivery_type === "PICKUP";

  const steps: StepInfo[] = [
    {
      id: "step-1",
      label: "Pedido Recibido",
      desc: "Registrado en el sistema",
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    {
      id: "step-2",
      label: order.payment_status === "APPROVED" || currentStep >= 2 ? "Pago Aprobado" : "Verificando Pago",
      desc: order.payment_status === "APPROVED" || currentStep >= 2 ? "Comprobante verificado" : "Revisión bancaria",
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
    },
    {
      id: "step-3",
      label: "Empacando",
      desc: "Preparando productos en tienda",
      icon: <Package className="w-3.5 h-3.5" />,
    },
    {
      id: "step-4",
      label: isPickup ? "Listo en Tienda" : "En Camino",
      desc: isPickup ? "Disponible para retiro" : "Repartidor en ruta",
      icon: isPickup ? <StoreIcon className="w-3.5 h-3.5" /> : <Truck className="w-3.5 h-3.5" />,
    },
    {
      id: "step-5",
      label: "Entregado",
      desc: "Pedido completado",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
  ];

  const items = order.items || [];
  const totalItemsCount = items.reduce((acc, it) => acc + it.quantity, 0);

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    order.order_number
  )}`;

  return (
    <BottomSheetModal
      isOpen={isOpen && !!order}
      onClose={onClose}
      maxWidth="max-w-2xl"
      bodyClassName="space-y-5 p-4 sm:p-6"
      customHeader={
        <div className="flex items-start justify-between gap-3 border-b border-border p-5 bg-gradient-to-r from-primary/5 via-card to-background shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {settings.logo_url ? (
              <div className="w-11 h-11 rounded-2xl bg-white p-1 border border-border shadow-xs shrink-0 flex items-center justify-center overflow-hidden">
                <img
                  src={settings.logo_url}
                  alt={settings.business_name}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary font-black flex items-center justify-center shrink-0 border border-primary/20">
                <StoreIcon className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-primary">
                Ticket Digital de Compra
              </span>
              <h3 className="font-extrabold text-base sm:text-lg text-foreground truncate">
                {settings.business_name}
              </h3>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3 h-3 shrink-0" />
                <span>{formattedDate}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="min-h-[40px] min-w-[40px] text-muted-foreground hover:text-foreground hover:bg-muted p-2 rounded-xl transition-colors hidden sm:flex items-center justify-center"
              title="Imprimir ticket"
              aria-label="Imprimir ticket"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] min-w-[40px] text-muted-foreground hover:text-foreground hover:bg-muted p-2 rounded-xl transition-colors flex items-center justify-center"
              aria-label="Cerrar ticket"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      }
    >
      {/* Order Banner & Number */}
      <div className="rounded-2xl bg-card border border-border p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground block">
              Número de Orden
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono font-black text-xl sm:text-2xl text-foreground tracking-tight">
                {order.order_number}
              </span>
              <button
                type="button"
                onClick={handleCopyOrderNumber}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Copiar número de orden"
                aria-label="Copiar número de orden"
              >
                {copiedOrder ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full border ${
                order.status === "COMPLETED"
                  ? "bg-emerald-600 text-white border-transparent"
                  : order.status === "CANCELLED"
                  ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                  : order.status === "READY" || order.status === "DELIVERING"
                  ? "bg-blue-600 text-white border-transparent animate-pulse"
                  : "bg-amber-500/15 text-amber-700 border-amber-500/30"
              }`}
            >
              {order.status === "COMPLETED" ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : order.status === "CANCELLED" ? (
                <AlertCircle className="w-3.5 h-3.5" />
              ) : (
                <Clock className="w-3.5 h-3.5" />
              )}
              <span>
                {order.status === "CREATED" && "Recibido"}
                {order.status === "PAYMENT_PENDING" && "Validando Pago"}
                {order.status === "PAYMENT_APPROVED" && "Pago Aprobado"}
                {order.status === "PREPARING" && "En Preparación"}
                {order.status === "READY" && (isPickup ? "Listo para Retirar" : "Listo para Envío")}
                {order.status === "DELIVERING" && "En Ruta"}
                {order.status === "COMPLETED" && "Entregado"}
                {order.status === "CANCELLED" && "Cancelado"}
              </span>
            </span>

            <span className="text-xs font-bold text-muted-foreground bg-muted/60 px-3 py-1 rounded-full border border-border">
              {isPickup ? "🏬 Retiro en Tienda" : "🛵 Delivery"}
            </span>
          </div>
        </div>

        {/* Visual Progress Stepper (Only if not cancelled) */}
        {order.status !== "CANCELLED" ? (
          <div className="pt-3 border-t border-border">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block mb-2.5">
              Estado del Pedido en Tiempo Real
            </span>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {steps.map((st, idx) => {
                const stepNum = idx + 1;
                const isPassed = currentStep > stepNum;
                const isCurrent = currentStep === stepNum;

                return (
                  <div key={st.id} className="flex flex-col items-center text-center">
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                        isPassed
                          ? "bg-emerald-600 text-white"
                          : isCurrent
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20 scale-105"
                          : "bg-muted text-muted-foreground/60 border border-border"
                      }`}
                    >
                      {isPassed ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : st.icon}
                    </div>
                    <span
                      className={`text-[10px] sm:text-[11px] font-extrabold mt-1.5 leading-tight line-clamp-1 ${
                        isCurrent
                          ? "text-primary"
                          : isPassed
                          ? "text-foreground"
                          : "text-muted-foreground/60"
                      }`}
                    >
                      {st.label}
                    </span>
                    <span className="text-[9px] text-muted-foreground hidden sm:block mt-0.5">
                      {st.desc}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              Este pedido fue cancelado. Si crees que se trata de un error, comunícate con la tienda.
            </span>
          </div>
        )}
      </div>

      {/* Customer & Document ID Identification Card */}
      <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Titular del Pedido (Presentar al Retirar)</span>
          </span>
          {order.customer_id_number && (
            <span className="text-[10px] font-bold text-muted-foreground">
              Documento Oficial
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-0.5">
          <div>
            <span className="text-[11px] text-muted-foreground block">Nombre del Cliente:</span>
            <p className="font-extrabold text-sm text-foreground mt-0.5">
              {order.customer_name || "Cliente General"}
            </p>
          </div>

          <div>
            <span className="text-[11px] text-muted-foreground block">Cédula de Identidad / RIF:</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="font-mono font-black text-sm text-primary">
                {order.customer_id_number || "No registrada"}
              </span>
              {order.customer_id_number && (
                <button
                  type="button"
                  onClick={handleCopyCi}
                  className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Copiar cédula"
                  aria-label="Copiar cédula"
                >
                  {copiedCi ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {isPickup && (
          <p className="text-[11px] text-muted-foreground bg-background/80 p-2.5 rounded-xl border border-border/60 mt-1">
            💡 <strong>Importante:</strong> Al momento de retirar en mostrador, indica tu número de orden y muestra tu documento de identidad para verificar la entrega.
          </p>
        )}
      </div>

      {/* Store Location or Delivery Address Card with QR Code */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Branch / Delivery Info (2 cols) */}
        <div className="sm:col-span-2 rounded-2xl bg-card border border-border p-4 space-y-2 text-xs flex flex-col justify-between">
          <div className="space-y-1.5">
            <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1.5">
              {isPickup ? <StoreIcon className="w-3.5 h-3.5 text-primary" /> : <Truck className="w-3.5 h-3.5 text-primary" />}
              <span>{isPickup ? "Punto de Retiro en Tienda" : "Dirección de Entrega"}</span>
            </span>

            {isPickup ? (
              <>
                <p className="font-extrabold text-sm text-foreground">
                  {order.store_name || store?.name || "Sucursal Principal"}
                </p>
                <p className="text-muted-foreground leading-relaxed flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>
                    {store?.address || "Calle 3 entre Carreras 1 y 2, Urb. Nueva Segovia, Barquisimeto"}
                  </span>
                </p>
                <div className="pt-1 text-[11px] text-muted-foreground space-y-0.5">
                  <p>
                    <strong>Horario de Atención:</strong> Lun a Sáb 8:00 AM – 7:00 PM | Dom 9:00 AM – 5:00 PM
                  </p>
                  {(store?.phone || settings.phone) && (
                    <p>
                      <strong>Teléfono Tienda:</strong> {store?.phone || settings.phone}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="font-extrabold text-sm text-foreground">
                  Despacho a Domicilio
                </p>
                <p className="text-muted-foreground leading-relaxed flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>{order.delivery_address || "Dirección indicada por el cliente"}</span>
                </p>
              </>
            )}
          </div>

          {isPickup && store?.address && (
            <div className="pt-2">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${settings.business_name} ${store.address}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary hover:underline bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Abrir Ubicación en Google Maps</span>
              </a>
            </div>
          )}
        </div>

        {/* Counter Scanner QR Code (1 col) */}
        <div className="rounded-2xl bg-card border border-border p-4 flex flex-col items-center justify-center text-center space-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <QrCode className="w-3 h-3 text-primary" />
            <span>Código de Retiro</span>
          </span>
          <div className="w-24 h-24 bg-white rounded-xl p-1.5 border border-border shadow-xs flex items-center justify-center">
            <img
              src={qrImageUrl}
              alt={`QR ${order.order_number}`}
              className="w-full h-full object-contain"
            />
          </div>
          <span className="font-mono text-[10px] text-muted-foreground font-bold">
            Escanear en Caja
          </span>
        </div>
      </div>

      {/* Itemized Purchased Products */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5 text-primary" />
            <span>Productos del Pedido ({totalItemsCount} {totalItemsCount === 1 ? "artículo" : "artículos"})</span>
          </h4>
        </div>

        {items.length === 0 ? (
          <div className="p-4 rounded-2xl bg-muted/30 border border-dashed border-border text-center text-xs text-muted-foreground">
            Sin artículos detallados registrados.
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

      {/* Financial Breakdown & Reported Payment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {/* Payment Summary */}
        <div className="bg-card p-3.5 rounded-2xl border border-border space-y-2">
          <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider block">
            Detalles del Pago
          </span>

          <div className="space-y-1">
            <p>
              <strong>Método:</strong>{" "}
              <span className="font-semibold text-foreground">
                {order.payment_method || "Pago Móvil / Transferencia"}
              </span>
            </p>
            {order.payment_reference && (
              <p>
                <strong>Referencia Reportada:</strong>{" "}
                <span className="font-mono font-bold text-foreground">
                  {order.payment_reference}
                </span>
              </p>
            )}
            <p className="flex items-center gap-1.5 pt-0.5">
              <strong>Estado del Pago:</strong>
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
                  ? "Aprobado / Conciliado"
                  : order.payment_status === "REJECTED"
                  ? "Pago Rechazado"
                  : "Por Conciliar"}
              </span>
            </p>
          </div>
        </div>

        {/* Totals */}
        <div className="bg-card p-3.5 rounded-2xl border border-border space-y-1.5">
          <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider block">
            Resumen de Cuenta
          </span>

          <div className="space-y-1 pt-1">
            {order.discount_usd && order.discount_usd > 0 ? (
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Descuento Cupón:</span>
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
              Tasa BCV aplicada: Bs. {order.exchange_rate_applied.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Customer CTA Actions */}
      <div className="pt-2 border-t border-border space-y-2">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full min-h-[44px] rounded-xl bg-emerald-600 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-md active:scale-[0.98]"
        >
          <MessageCircle className="w-4 h-4" />
          <span>Consultar o Notificar a la Tienda por WhatsApp</span>
        </a>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 min-h-[40px] rounded-xl border border-border text-foreground text-xs font-semibold hover:bg-muted flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir / Guardar Ticket</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[40px] rounded-xl bg-muted text-foreground text-xs font-semibold hover:bg-muted/80 cursor-pointer"
          >
            Volver a la Tienda
          </button>
        </div>
      </div>
    </BottomSheetModal>
  );
}
