"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Order,
  OrderStatus,
  TenantSettings,
  Store,
  TenantModuleId,
  extractGpsCoordinates,
} from "@marketos/types";
import { formatCurrency, generateCustomerOrderWhatsAppLink } from "@marketos/utils";
import { BottomSheetModal } from "./bottom-sheet-modal";
import { trackOrderAction } from "../app/actions";
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
  Receipt,
  Scale,
  RefreshCw,
} from "lucide-react";

interface CustomerOrderTicketModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  settings: TenantSettings;
  store?: Store;
  activeModuleIds?: TenantModuleId[];
}

interface StepInfo {
  id: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
}

export function CustomerOrderTicketModal({
  order: initialOrder,
  isOpen,
  onClose,
  settings,
  store,
  activeModuleIds = [],
}: CustomerOrderTicketModalProps) {
  const isVenezuelaActive = activeModuleIds.includes("local_venezuela");
  const [copiedOrder, setCopiedOrder] = useState(false);
  const [copiedCi, setCopiedCi] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Live order state with automatic background refresh
  const [order, setOrder] = useState<Order | null>(initialOrder);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusUpdatedNotice, setStatusUpdatedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (initialOrder) {
      setOrder(initialOrder);
    }
  }, [initialOrder]);

  // Real-time polling every 4 seconds while modal is open
  useEffect(() => {
    if (!isOpen || !order) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const queryTerm = order.order_number || order.id;
        const res = await trackOrderAction(settings.tenant_id, queryTerm);
        if (isMounted && res.success && res.orders && res.orders.length > 0) {
          const fresh = res.orders.find(
            (o) => o.id === order.id || o.order_number === order.order_number
          );
          if (fresh) {
            setOrder((prev) => {
              if (!prev) return fresh;
              if (
                prev.status !== fresh.status ||
                prev.payment_status !== fresh.payment_status ||
                prev.driver_id !== fresh.driver_id
              ) {
                setStatusUpdatedNotice(`¡Estado actualizado: ${fresh.status}!`);
                setTimeout(() => setStatusUpdatedNotice(null), 4000);
                return fresh;
              }
              return prev;
            });
          }
        }
      } catch {
        // Silent polling error
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, order?.id, order?.order_number, settings.tenant_id]);

  const handleManualRefresh = async () => {
    if (!order) return;
    setIsRefreshing(true);
    try {
      const queryTerm = order.order_number || order.id;
      const res = await trackOrderAction(settings.tenant_id, queryTerm);
      if (res.success && res.orders && res.orders.length > 0) {
        const fresh = res.orders.find(
          (o) => o.id === order.id || o.order_number === order.order_number
        );
        if (fresh) {
          setOrder(fresh);
          setStatusUpdatedNotice("Actualizado");
          setTimeout(() => setStatusUpdatedNotice(null), 2500);
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  };

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
    isVenezuelaActive,
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
  const gpsInfo = extractGpsCoordinates(order.delivery_address);
  const displayDeliveryAddress = gpsInfo.cleanAddress || order.delivery_address;
  const deliveryMapsUrl =
    order.delivery_maps_url ||
    gpsInfo.mapsUrl ||
    (order.delivery_latitude != null && order.delivery_longitude != null
      ? `https://www.google.com/maps?q=${order.delivery_latitude},${order.delivery_longitude}`
      : null);

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

  // SENIAT Fiscal Compliance Status (Providencia 00071 & Factura Digital)
  const isFiscal = isVenezuelaActive && Boolean(order.is_fiscal_invoice || settings.billing_settings?.fiscal_billing_enabled);
  const billingSettings = settings.billing_settings;
  const emitterRif = billingSettings?.emitter_fiscal_data?.rif || "J-50123456-7";
  const emitterBusinessName = billingSettings?.emitter_fiscal_data?.business_name || settings.business_name;
  const emitterAddress = billingSettings?.emitter_fiscal_data?.fiscal_address || settings.address;
  const emitterPhone = billingSettings?.emitter_fiscal_data?.phone || settings.phone;
  const invoiceNumber = order.fiscal_invoice_number || `FACT-${order.order_number.replace(/^ORD-/, "")}`;
  const controlNumber = order.fiscal_control_number || `00-${order.order_number.replace(/^ORD-/, "000")}`;
  const cuv = order.fiscal_cuv || `CUV-${order.order_number.replace(/^ORD-/, "")}`;

  // Fiscal Calculations (Providencia 00071)
  const ivaRate = (billingSettings?.default_iva_rate || 16) / 100;
  const subtotalTaxableUsd = order.subtotal_taxable_usd ?? Number((order.total_usd / (1 + ivaRate)).toFixed(2));
  const subtotalExemptUsd = order.subtotal_exempt_usd ?? 0;
  const ivaAmountUsd = order.iva_amount_usd ?? Number((order.total_usd - subtotalTaxableUsd).toFixed(2));
  const ivaAmountVes = order.iva_amount_ves ?? Number((ivaAmountUsd * order.exchange_rate_applied).toFixed(2));
  const taxableVes = Number((subtotalTaxableUsd * order.exchange_rate_applied).toFixed(2));
  const exemptVes = Number((subtotalExemptUsd * order.exchange_rate_applied).toFixed(2));
  const hasIgtf = Boolean(
    billingSettings?.apply_igtf &&
      (order.payment_method === "CASH_USD" || order.payment_method === "ZELLE")
  );
  const igtfAmountUsd = order.igtf_amount_usd ?? (hasIgtf ? Number((order.total_usd * 0.03).toFixed(2)) : 0);
  const igtfAmountVes = order.igtf_amount_ves ?? Number((igtfAmountUsd * order.exchange_rate_applied).toFixed(2));

  // QR Code visibility flag from operational settings (defaults to true)
  const showQr = settings.operational_settings?.show_ticket_qr !== false;

  // Smart tracking URL: when scanned by smartphone camera, opens live order tracker
  const trackingUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?track=${encodeURIComponent(order.order_number)}`
      : `/?track=${order.order_number}`;

  const qrImageUrl = isFiscal && order.fiscal_qr_url
    ? order.fiscal_qr_url
    : `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(trackingUrl)}`;

  return (
    <>
      {/* ============================================================== */}
      {/* 1. DEDICATED PRINTABLE TICKET (Portalled directly to body)      */}
      {/* ============================================================== */}
      {isMounted && typeof document !== "undefined"
        ? createPortal(
            <div id="printable-order-ticket" className="print-only-ticket">
              {/* Header with Store Logo & Metadata */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3 mb-3">
                <div className="flex items-center gap-2.5">
                  {settings.logo_url ? (
                    <img
                      src={settings.logo_url}
                      alt={isFiscal ? emitterBusinessName : settings.business_name}
                      className="h-12 w-auto max-w-[120px] object-contain"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-lg bg-slate-900 text-white font-black flex items-center justify-center text-lg">
                      SM
                    </div>
                  )}
                  <div>
                    <h1 className="text-lg font-black tracking-tight text-slate-950 uppercase leading-none">
                      {isFiscal ? emitterBusinessName : settings.business_name}
                    </h1>
                    {isFiscal && (
                      <p className="text-[11px] font-mono font-black text-slate-900 mt-0.5">
                        RIF: {emitterRif}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {settings.category || "Comercio Digital"} {settings.address ? `• ${settings.address}` : ""}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {(isFiscal ? emitterAddress : settings.address) && `${isFiscal ? emitterAddress : settings.address} • `}
                      {(isFiscal ? emitterPhone : settings.phone) && `Tlf: ${isFiscal ? emitterPhone : settings.phone}`}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-block text-white text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider ${
                      isFiscal
                        ? "bg-emerald-700"
                        : order.physical_invoice_number
                        ? "bg-blue-700"
                        : "bg-slate-900"
                    }`}
                  >
                    {isFiscal
                      ? "FACTURA FISCAL DIGITAL"
                      : order.physical_invoice_number
                      ? `FACTURA FÍSICA N° ${order.physical_invoice_number}`
                      : "COMPROBANTE DE COMPRA"}
                  </span>
                  <div className="mt-1 font-mono font-black text-base text-slate-950">
                    {isFiscal ? invoiceNumber : `#${order.order_number}`}
                  </div>
                  {isFiscal && (
                    <div className="text-[10px] font-mono font-black text-slate-700">
                      N° Control: {controlNumber}
                    </div>
                  )}
                  {!isFiscal && order.physical_machine_serial && (
                    <div className="text-[10px] font-mono font-black text-slate-700">
                      MF: {order.physical_machine_serial}
                    </div>
                  )}
                  <div className="text-[10px] text-slate-600 font-medium">
                    {formattedDate}
                  </div>
                </div>
              </div>

              {/* Providencia 00071 Mandatory Non-Fiscal Warning Banner */}
              {!isFiscal && (
                <div className="mb-2.5 py-1 px-2.5 rounded border border-slate-400 bg-slate-100 text-center">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-900">
                    {order.physical_invoice_number
                      ? `FACTURA FISCAL EMITIDA EN CAJA N° ${order.physical_invoice_number} ${order.physical_machine_serial ? `• SERIAL: ${order.physical_machine_serial}` : ""}`
                      : (billingSettings?.non_fiscal_warning_legend || "DOCUMENTO NO FISCAL - EXIJA SU FACTURA FISCAL EN CAJA")}
                  </p>
                </div>
              )}

              {/* Customer & Delivery Information Block */}
              <div className="grid grid-cols-2 gap-3 p-2.5 rounded-lg border border-slate-300 bg-slate-50/70 text-xs mb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Datos del Cliente
                  </span>
                  <p className="font-extrabold text-slate-900 text-sm mt-0.5">
                    {order.customer_name || "Cliente General"}
                  </p>
                  <p className="text-slate-700 font-mono text-[11px] mt-0.5">
                    <strong>C.I. / RIF:</strong> {order.customer_id_number || "No registrada"}
                  </p>
                  {order.customer_phone && (
                    <p className="text-slate-700 text-[11px]">
                      <strong>Teléfono:</strong> {order.customer_phone}
                    </p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Modalidad de Despacho
                  </span>
                  <p className="font-extrabold text-slate-900 text-sm mt-0.5">
                    {isPickup ? "🏬 Retiro en Tienda / Sede" : "🛵 Envío a Domicilio (Delivery)"}
                  </p>
                  <p className="text-slate-700 text-[11px] mt-0.5 leading-snug">
                    {isPickup ? (
                      <>
                        <strong>Sede:</strong> {order.store_name || store?.name || "Sucursal Principal"}
                        {store?.address && <span className="block text-slate-500 text-[10px]">{store.address}</span>}
                      </>
                    ) : (
                      <>
                        <strong>Dirección:</strong> {displayDeliveryAddress || "Indicada por el cliente"}
                        {deliveryMapsUrl && (
                          <span className="block mt-0.5 text-slate-500 text-[10px]">
                            📍 Pin Satelital GPS: {deliveryMapsUrl}
                          </span>
                        )}
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Itemized Purchased Products Table */}
              <div className="mb-3">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-900 text-slate-700 text-[10px] uppercase font-black">
                      <th className="py-1 text-center w-12">Cant.</th>
                      <th className="py-1 text-left">Producto / Descripción</th>
                      <th className="py-1 text-right w-24">P. Unit ($)</th>
                      <th className="py-1 text-right w-24">Total ($)</th>
                      {isVenezuelaActive && <th className="py-1 text-right w-28">Total (Bs.)</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((item, idx) => (
                      <tr key={item.id || idx} className="text-slate-900">
                        <td className="py-1 text-center font-bold font-mono">
                          {item.quantity}x
                        </td>
                        <td className="py-1 font-medium pr-2">
                          {item.product_name}
                        </td>
                        <td className="py-1 text-right font-mono text-slate-600">
                          ${item.unit_price_usd.toFixed(2)}
                        </td>
                        <td className="py-1 text-right font-mono font-bold">
                          ${item.total_price_usd.toFixed(2)}
                        </td>
                        {isVenezuelaActive && (
                          <td className="py-1 text-right font-mono text-slate-700">
                            Bs. {(item.total_price_usd * order.exchange_rate_applied).toFixed(2)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Breakdown & Payment Info */}
              <div className="grid grid-cols-2 gap-3 border-t-2 border-slate-900 pt-2.5 text-xs mb-3">
                {/* Payment Method Details */}
                <div className="space-y-1 text-slate-700">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    Detalles del Pago
                  </span>
                  <p>
                    <strong>Método:</strong> {order.payment_method || "Pago Móvil / Transferencia"}
                  </p>
                  {order.payment_reference && (
                    <p>
                      <strong>Referencia:</strong>{" "}
                      <span className="font-mono font-bold text-slate-900">
                        {order.payment_reference}
                      </span>
                    </p>
                  )}
                  <p>
                    <strong>Estado del Pago:</strong>{" "}
                    <span className="font-bold text-slate-900">
                      {order.payment_status === "APPROVED"
                        ? "Aprobado / Conciliado"
                        : order.payment_status === "REJECTED"
                        ? "Rechazado"
                        : "Por Conciliar"}
                    </span>
                  </p>
                  {isVenezuelaActive && (
                    <p className="text-[10px] text-slate-500 pt-0.5">
                      Tasa Oficial BCV: Bs. {order.exchange_rate_applied.toFixed(2)}
                    </p>
                  )}
                </div>

                {/* Totals Calculation */}
                <div className="space-y-1 text-right">
                  {order.discount_usd && order.discount_usd > 0 ? (
                    <div className="flex justify-between text-slate-600">
                      <span>Descuento Cupón:</span>
                      <span>-${order.discount_usd.toFixed(2)}</span>
                    </div>
                  ) : null}

                  {order.delivery_fee_usd && order.delivery_fee_usd > 0 ? (
                    <div className="flex justify-between text-slate-600">
                      <span>Tarifa Delivery:</span>
                      <span>+${order.delivery_fee_usd.toFixed(2)}</span>
                    </div>
                  ) : null}

                  {isFiscal ? (
                    <div className="pt-1 pb-1 space-y-0.5 border-t border-slate-300 text-[11px] text-slate-700">
                      <div className="flex justify-between">
                        <span>Subtotal Exento / Exonerado:</span>
                        <span className="font-mono">${subtotalExemptUsd.toFixed(2)} | Bs. {exemptVes.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Base Imponible Gravable (16%):</span>
                        <span className="font-mono">${subtotalTaxableUsd.toFixed(2)} | Bs. {taxableVes.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-slate-900">
                        <span>IVA Liquidado (16%):</span>
                        <span className="font-mono font-bold">${ivaAmountUsd.toFixed(2)} | Bs. {ivaAmountVes.toFixed(2)}</span>
                      </div>
                      {igtfAmountUsd > 0 && (
                        <div className="flex justify-between font-bold text-amber-900 bg-amber-50 px-1 py-0.5 rounded">
                          <span>IGTF (3% Divisas):</span>
                          <span className="font-mono">${igtfAmountUsd.toFixed(2)} | Bs. {igtfAmountVes.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  ) : null}

                  <div className="flex justify-between items-baseline pt-1 border-t border-slate-300">
                    <span className="font-black text-sm text-slate-900">
                      {isFiscal ? "TOTAL FACTURA USD:" : "TOTAL USD:"}
                    </span>
                    <span className="font-mono font-black text-base sm:text-lg text-slate-950">
                      ${order.total_usd.toFixed(2)}
                    </span>
                  </div>

                  {isVenezuelaActive && (
                    <div className="flex justify-between items-baseline font-mono">
                      <span className="text-slate-600 font-bold text-xs">
                        {isFiscal ? "TOTAL FACTURA BOLÍVARES:" : "TOTAL BOLÍVARES:"}
                      </span>
                      <span className="font-bold text-sm sm:text-base text-slate-950">
                        Bs. {order.total_ves.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* QR Code and Footer (Only shown if showQr is enabled) */}
              {showQr && (
                <div className="flex items-center justify-between border-t border-dashed border-slate-300 pt-2.5 mb-1.5">
                  <div className="space-y-0.5 text-slate-600 text-[11px] max-w-[70%]">
                    <p className="font-bold text-slate-900 flex items-center gap-1">
                      <QrCode className="w-3.5 h-3.5" />
                      <span>{isFiscal ? "Validación Fiscal Digital SENIAT" : "Rastreo Digital en Tiempo Real"}</span>
                    </p>
                    <p className="text-[10px] text-slate-500 leading-snug">
                      {isFiscal
                        ? "Escanea este código con tu teléfono para verificar la autenticidad y validez fiscal de este documento ante la plataforma fiscal autorizada."
                        : "Escanea este código con la cámara de tu smartphone para consultar el estado del pedido, ruta de despacho y confirmación en tiempo real."}
                    </p>
                    {isFiscal && (
                      <p className="text-[9px] font-mono text-slate-600 pt-0.5">
                        <strong>CUV:</strong> {cuv}
                      </p>
                    )}
                  </div>
                  <div className="w-16 h-16 bg-white p-1 border border-slate-300 rounded shrink-0 flex items-center justify-center">
                    <img
                      src={qrImageUrl}
                      alt={`QR ${isFiscal ? invoiceNumber : order.order_number}`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Closing Legal / Thank-you note */}
              <div className="text-center text-[9px] sm:text-[10px] text-slate-500 pt-1.5 border-t border-slate-200">
                {isFiscal
                  ? `Factura digital emitida conforme a la Providencia Administrativa SNAT/2011/00071 y normativas de Facturación Digital para Comercio Electrónico. Proveedor: ${billingSettings?.fiscal_provider || "The Factory HKA"} • Control: ${controlNumber}`
                  : order.physical_invoice_number
                  ? `Pedido amparado por Factura Fiscal Física N° ${order.physical_invoice_number} emitida en mostrador. ¡Gracias por su compra en ${settings.business_name}!`
                  : `DOCUMENTO NO FISCAL (Providencia SNAT/2011/00071) • Comprobante interno de preventa y despacho. ¡Gracias por su compra en ${settings.business_name}!`}
              </div>
            </div>,
            document.body
          )
        : null}

      {/* ============================================================== */}
      {/* 2. ON-SCREEN INTERACTIVE MODAL (Hidden during window.print)     */}
      {/* ============================================================== */}
      <div className="no-print">
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
                  <span className="text-[10px] font-black uppercase tracking-wider text-primary flex items-center gap-1">
                    {isFiscal ? (
                      <>
                        <Receipt className="w-3 h-3 text-emerald-600" />
                        <span>Factura Fiscal Digital (SENIAT)</span>
                      </>
                    ) : (
                      <span>Ticket Digital de Compra</span>
                    )}
                  </span>
                  <h3 className="font-extrabold text-base sm:text-lg text-foreground truncate">
                    {isFiscal ? emitterBusinessName : settings.business_name}
                  </h3>
                  {isFiscal && (
                    <span className="text-[11px] font-mono font-bold text-muted-foreground block">
                      RIF: {emitterRif}
                    </span>
                  )}
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
                  className="min-h-[40px] min-w-[40px] text-muted-foreground hover:text-foreground hover:bg-muted p-2 rounded-xl transition-colors hidden sm:flex items-center justify-center cursor-pointer"
                  title="Imprimir ticket"
                  aria-label="Imprimir ticket"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[40px] min-w-[40px] text-muted-foreground hover:text-foreground hover:bg-muted p-2 rounded-xl transition-colors flex items-center justify-center cursor-pointer"
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
                  {isFiscal ? "Documento Fiscal & Orden" : "Número de Orden"}
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
                {isFiscal && (
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      N° Factura: {invoiceNumber}
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                      N° Control: {controlNumber}
                    </span>
                  </div>
                )}
                {!isFiscal && order.physical_invoice_number && (
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 border border-blue-500/20">
                      Factura Física en Caja: N° {order.physical_invoice_number}
                    </span>
                    {order.physical_machine_serial && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                        MF: {order.physical_machine_serial}
                      </span>
                    )}
                  </div>
                )}
                {!isFiscal && !order.physical_invoice_number && (
                  <div className="mt-1.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                      {billingSettings?.non_fiscal_warning_legend || "DOCUMENTO NO FISCAL - EXIJA SU FACTURA EN CAJA"}
                    </span>
                  </div>
                )}
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
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      Seguimiento en Vivo
                    </span>
                    {statusUpdatedNotice && (
                      <span className="ml-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 animate-pulse">
                        {statusUpdatedNotice}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleManualRefresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80 transition-colors px-2 py-0.5 rounded-md hover:bg-primary/10 cursor-pointer"
                    title="Actualizar estado del pedido"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
                    <span>{isRefreshing ? "Actualizando..." : "Actualizar"}</span>
                  </button>
                </div>
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

          {/* Store Location or Delivery Address Card (with optional QR code) */}
          <div className={`grid grid-cols-1 ${showQr ? "sm:grid-cols-3" : "grid-cols-1"} gap-3`}>
            {/* Branch / Delivery Info */}
            <div className={`${showQr ? "sm:col-span-2" : "col-span-1"} rounded-2xl bg-card border border-border p-4 space-y-2 text-xs flex flex-col justify-between`}>
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
                        {store?.address || settings.address || "Dirección de retiro en tienda"}
                      </span>
                    </p>
                    <div className="pt-1 text-[11px] text-muted-foreground space-y-0.5">
                      <p>
                        <strong>Horario de Atención:</strong> {settings.operational_settings?.schedule || "Lunes a Sábado en horario comercial"}
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
                      <span>{displayDeliveryAddress || "Dirección indicada por el cliente"}</span>
                    </p>
                    {deliveryMapsUrl && (
                      <div className="pt-2">
                        <a
                          href={deliveryMapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 shadow-2xs transition-all active:scale-98"
                        >
                          <ExternalLink className="w-3 h-3 text-emerald-600" />
                          <span>📍 Ver Pin Satelital en Google Maps</span>
                        </a>
                      </div>
                    )}
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

            {/* Smart Tracking QR Code (Rendered only when showQr is active) */}
            {showQr && (
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
                <span className="font-mono text-[9px] text-muted-foreground font-bold">
                  Escanea para rastrear
                </span>
              </div>
            )}
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

                {isFiscal ? (
                  <div className="pt-1.5 pb-0.5 border-t border-border space-y-1 text-[11px] text-muted-foreground">
                    {subtotalExemptUsd > 0 && (
                      <div className="flex justify-between">
                        <span>Subtotal Exento (IVA 0%):</span>
                        <span className="font-mono text-foreground font-semibold">
                          {formatCurrency(subtotalExemptUsd, "USD")}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Base Gravable (16%):</span>
                      <span className="font-mono text-foreground font-semibold">
                        {formatCurrency(subtotalTaxableUsd, "USD")}
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold text-foreground">
                      <span>IVA Liquidado (16%):</span>
                      <span className="font-mono text-primary font-bold">
                        {formatCurrency(ivaAmountUsd, "USD")} (Bs. {ivaAmountVes.toFixed(2)})
                      </span>
                    </div>
                    {igtfAmountUsd > 0 && (
                      <div className="flex justify-between font-bold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                        <span>IGTF (3% Divisas):</span>
                        <span className="font-mono">
                          {formatCurrency(igtfAmountUsd, "USD")} (Bs. {igtfAmountVes.toFixed(2)})
                        </span>
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="border-t border-border pt-1.5 mt-1 flex justify-between items-baseline">
                  <span className="font-black text-sm text-foreground">
                    {isFiscal ? "Total Factura USD:" : "Total USD:"}
                  </span>
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
                      Tasa BCV aplicada: Bs. {order.exchange_rate_applied.toFixed(2)}
                    </div>
                  </>
                )}
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
      </div>

      {/* ============================================================== */}
      {/* 3. DEDICATED PRINT ISOLATION STYLES                            */}
      {/* ============================================================== */}
      <style jsx global>{`
        @media screen {
          .print-only-ticket,
          #printable-order-ticket {
            display: none !important;
          }
        }
        @media print {
          /* 1. Reset Root & Body */
          html, body {
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* 2. Completely isolate printable ticket: remove ALL other body siblings from print flow */
          body > *:not(#printable-order-ticket) {
            display: none !important;
            height: 0 !important;
            max-height: 0 !important;
            overflow: hidden !important;
            visibility: hidden !important;
          }

          /* 3. Completely hide on-screen non-printable chrome */
          .no-print,
          .no-print *,
          [role="dialog"],
          .fixed.inset-0,
          header,
          footer,
          nav {
            display: none !important;
            visibility: hidden !important;
          }

          /* 4. Display ONLY the dedicated printable ticket container in normal document flow */
          #printable-order-ticket,
          .print-only-ticket {
            display: block !important;
            visibility: visible !important;
            position: relative !important;
            top: 0 !important;
            left: 0 !important;
            margin: 0 auto !important;
            padding: 4mm 6mm !important;
            width: 100% !important;
            max-width: 190mm !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
            z-index: 99999999 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-before: avoid !important;
            break-before: avoid !important;
          }

          #printable-order-ticket * {
            visibility: visible !important;
          }

          /* Prevent unwanted breaks inside tables, rows and images */
          #printable-order-ticket tr,
          #printable-order-ticket td,
          #printable-order-ticket th,
          #printable-order-ticket img,
          #printable-order-ticket table {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Auto page sizing with neat margins for single-page fit across A4 and Letter */
          @page {
            size: auto;
            margin: 6mm 8mm;
          }
        }
      `}</style>
    </>
  );
}
