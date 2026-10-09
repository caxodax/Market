"use client";

import React, { useState, useId } from "react";
import { Store, TenantSettings, Order, DeliveryZone } from "@marketos/types";
import { useCart } from "../context/cart-context";
import { formatCurrency, convertUsdToVes } from "@marketos/utils";
import {
  createOrderAction,
  submitPaymentProofAction,
  validateCouponAction,
  uploadPaymentProofToR2Action,
} from "../app/actions";
import {
  X,
  CreditCard,
  Truck,
  Store as StoreIcon,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Loader2,
  Tag,
  Upload,
  Clock,
  MapPin,
  Check,
  Copy,
  Building2,
  ArrowLeft,
} from "lucide-react";

interface CheckoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TenantSettings;
  stores: Store[];
  deliveryZones: DeliveryZone[];
  exchangeRate: number;
  onOrderCompleted: (order: Order) => void;
}

export function CheckoutDialog({
  isOpen,
  onClose,
  settings,
  stores,
  deliveryZones,
  exchangeRate,
  onOrderCompleted,
}: CheckoutDialogProps) {
  const { items, totalUsd: rawSubtotalUsd, clearCart } = useCart();
  const fileInputId = useId();

  const [step, setStep] = useState<"DETAILS" | "PAYMENT">("DETAILS");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryType, setDeliveryType] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [selectedZoneId, setSelectedZoneId] = useState<string>(
    deliveryZones[0]?.id || ""
  );
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryReference, setDeliveryReference] = useState("");

  // Coupon states
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountUsd: number;
    description?: string | null;
  } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);

  // Payment states
  const paymentSettings = settings.payment_settings;
  const initialPaymentMethod = (paymentSettings?.enabled_methods?.[0] as any) || "PAGO_MOVIL";
  const [paymentMethod, setPaymentMethod] = useState<
    "PAGO_MOVIL" | "BANK_TRANSFER" | "ZELLE" | "CASH_USD"
  >(initialPaymentMethod);
  const [bankName, setBankName] = useState(paymentSettings?.pago_movil?.bank || "Bancamiga");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!isOpen) return null;

  // Payment methods and accounts config
  const allPaymentMethodOptions: { id: "PAGO_MOVIL" | "BANK_TRANSFER" | "ZELLE" | "CASH_USD"; label: string }[] = [
    { id: "PAGO_MOVIL", label: "Pago Móvil" },
    { id: "BANK_TRANSFER", label: "Transferencia Bs." },
    { id: "ZELLE", label: "Zelle USD" },
    { id: "CASH_USD", label: "Efectivo Tienda" },
  ];

  const enabledMethodKeys = paymentSettings?.enabled_methods;
  const availablePaymentMethods = enabledMethodKeys && enabledMethodKeys.length > 0
    ? allPaymentMethodOptions.filter((opt) => enabledMethodKeys.includes(opt.id))
    : allPaymentMethodOptions;

  const activePaymentMethod = availablePaymentMethods.some((m) => m.id === paymentMethod)
    ? paymentMethod
    : (availablePaymentMethods[0]?.id || "PAGO_MOVIL");

  const pmData = paymentSettings?.pago_movil || {
    bank: "Bancamiga",
    phone: "04245919577",
    id_doc: "J-50123456-7",
    name: settings.business_name,
  };

  const btData = paymentSettings?.bank_transfer || {
    bank: "Bancamiga",
    account_number: "01720111551100012345",
    account_type: "Corriente",
    id_doc: "J-50123456-7",
    name: settings.business_name,
  };

  const zelleData = paymentSettings?.zelle || {
    email: "pagos@shopmarket.com",
    name: settings.business_name,
  };

  const cashInstructions = paymentSettings?.cash_usd?.instructions ||
    "Pagas el monto exacto en dólares o bolívares al momento de retirar tu pedido en tienda o cuando el repartidor llegue a tu domicilio.";

  // Calculations
  const selectedZone = deliveryZones.find((z) => z.id === selectedZoneId) || deliveryZones[0];
  const deliveryFeeUsd = deliveryType === "DELIVERY" ? selectedZone?.price_usd || 0 : 0;
  const discountUsd = appliedCoupon ? appliedCoupon.discountUsd : 0;
  const subtotalUsd = rawSubtotalUsd;
  const totalUsd = Math.max(0, subtotalUsd - discountUsd + deliveryFeeUsd);
  const totalVes = convertUsdToVes(totalUsd, exchangeRate);
  const selectedStore = stores[0] || {
    id: "default-store",
    name: "Shop Market Nueva Segovia",
  };

  // Coupon application handler
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponMessage(null);

    const res = await validateCouponAction(
      settings.tenant_id,
      couponCode.trim(),
      subtotalUsd
    );

    setCouponLoading(false);
    if (res.valid && res.coupon) {
      setAppliedCoupon({
        code: res.coupon.code,
        discountUsd: res.discountUsd,
        description: res.coupon.description,
      });
      setCouponMessage(`✓ Cupón aplicado: -$${res.discountUsd.toFixed(2)} USD`);
    } else {
      setAppliedCoupon(null);
      setCouponMessage(res.message || "Cupón no válido");
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponMessage(null);
  };

  const handleCopy = (text: string, fieldId: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 1800);
    } catch (e) {
      console.warn("Could not copy to clipboard", e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofFile(file);
      const url = URL.createObjectURL(file);
      setProofPreview(url);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerName.trim() || !customerPhone.trim()) {
      setError("Por favor completa tu nombre y número de teléfono (WhatsApp)");
      return;
    }

    if (deliveryType === "DELIVERY" && !deliveryAddress.trim()) {
      setError("Por favor indica la dirección exacta para el despacho a domicilio");
      return;
    }

    if (
      (paymentMethod === "PAGO_MOVIL" || paymentMethod === "BANK_TRANSFER") &&
      !referenceNumber.trim()
    ) {
      setError("Por favor ingresa los últimos 4 a 6 dígitos de tu número de referencia");
      return;
    }

    setLoading(true);

    try {
      // 1. Upload proof to Cloudflare R2 if attached
      let proofImageUrl: string | undefined = undefined;
      if (proofFile) {
        const formData = new FormData();
        formData.append("file", proofFile);
        formData.append("tenantId", settings.tenant_id);

        const uploadRes = await uploadPaymentProofToR2Action(formData);
        if (uploadRes.success && uploadRes.url) {
          proofImageUrl = uploadRes.url;
        }
      }

      // 2. Create order with Phase 2 fields
      const fullDeliveryAddress =
        deliveryType === "DELIVERY"
          ? `${deliveryAddress} ${deliveryReference ? `(Ref: ${deliveryReference})` : ""} - Zona: ${selectedZone?.name || ""}`
          : undefined;

      const orderRes = await createOrderAction({
        tenantId: settings.tenant_id,
        storeId: selectedStore.id,
        customerName,
        customerPhone,
        deliveryType,
        deliveryZoneId: deliveryType === "DELIVERY" ? selectedZone?.id : undefined,
        deliveryAddress: fullDeliveryAddress,
        deliveryFeeUsd,
        couponCode: appliedCoupon?.code,
        discountUsd,
        items: items.map((i) => ({
          productId: i.product.id,
          productName: i.product.name,
          quantity: i.quantity,
          unitPriceUsd: i.product.price_usd,
        })),
        notes: `Método: ${paymentMethod} | ${deliveryType === "DELIVERY" ? `Zona: ${selectedZone?.name}` : "Retiro en Tienda"}`,
      });

      if (!orderRes.success || !orderRes.order) {
        throw new Error(orderRes.error || "No se pudo generar la orden");
      }

      // 3. Submit payment proof
      await submitPaymentProofAction({
        tenantId: settings.tenant_id,
        orderId: orderRes.order.id,
        method: paymentMethod,
        bankName:
          paymentMethod === "PAGO_MOVIL" || paymentMethod === "BANK_TRANSFER"
            ? bankName
            : undefined,
        referenceNumber: referenceNumber || "CASH-PENDING",
        amount: paymentMethod === "ZELLE" ? totalUsd : totalVes,
        currency: paymentMethod === "ZELLE" ? "USD" : "VES",
        proofImageUrl,
      });

      clearCart();
      onOrderCompleted(orderRes.order);
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al procesar el pedido. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Stepper Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === "DETAILS"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-emerald-600 text-white"
                }`}
              >
                {step === "DETAILS" ? "1" : "✓"}
              </span>
              <span
                className={`text-xs font-bold ${
                  step === "DETAILS" ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                Entrega
              </span>
            </div>

            <span className="text-muted-foreground/30 text-xs select-none">─────</span>

            <div className="flex items-center gap-2">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === "PAYMENT"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                2
              </span>
              <span
                className={`text-xs font-bold ${
                  step === "PAYMENT" ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                Pago
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === "DETAILS" ? (
            <>
              {/* Customer info */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Datos de Contacto
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Tu Nombre completo"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-11 px-3 rounded-xl border border-input bg-background text-xs focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Teléfono / WhatsApp"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="h-11 px-3 rounded-xl border border-input bg-background text-xs focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Delivery method toggle */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Modalidad de Entrega
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryType("PICKUP")}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                      deliveryType === "PICKUP"
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <StoreIcon className="w-4 h-4" />
                    <span className="text-xs">Retiro en Tienda</span>
                    <span className="text-[10px] opacity-75">Gratis (Nueva Segovia)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryType("DELIVERY")}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                      deliveryType === "DELIVERY"
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Truck className="w-4 h-4" />
                    <span className="text-xs">Delivery a Domicilio</span>
                    <span className="text-[10px] opacity-75">
                      Desde {formatCurrency(0, "USD")}
                    </span>
                  </button>
                </div>
              </div>

              {/* Delivery details & Zone selection */}
              {deliveryType === "DELIVERY" && (
                <div className="space-y-3 p-3.5 rounded-xl bg-muted/30 border border-border animate-in fade-in">
                  <div>
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5 mb-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                      Zona de Entrega (Barquisimeto / Cabudare)
                    </label>
                    <select
                      value={selectedZoneId}
                      onChange={(e) => setSelectedZoneId(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-input bg-background text-xs font-medium focus:ring-2 focus:ring-primary"
                    >
                      {deliveryZones.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.name} — {zone.price_usd === 0 ? "GRATIS" : `$${zone.price_usd.toFixed(2)}`} ({zone.estimated_time})
                        </option>
                      ))}
                    </select>
                    {selectedZone?.coverage_description && (
                      <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-primary shrink-0" />
                        <span>{selectedZone.coverage_description}</span>
                      </p>
                    )}
                  </div>

                  <input
                    type="text"
                    required
                    placeholder="Dirección exacta (Urbanización, Carrera/Calle, Casa/Apto)"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-input bg-background text-xs focus:ring-2 focus:ring-primary"
                  />

                  <input
                    type="text"
                    placeholder="Punto de referencia o instrucciones al repartidor"
                    value={deliveryReference}
                    onChange={(e) => setDeliveryReference(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}

              {/* Coupon / Promotion Section */}
              <div className="p-3.5 rounded-xl bg-muted/20 border border-border space-y-2">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-primary" />
                  Cupón de Descuento
                </label>

                {!appliedCoupon ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ej. BIENVENIDO o SHOP10"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      className="flex-1 h-10 px-3 rounded-xl border border-input bg-background text-xs uppercase font-mono tracking-wider focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="button"
                      disabled={couponLoading || !couponCode.trim()}
                      onClick={handleApplyCoupon}
                      className="px-4 h-10 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/80 disabled:opacity-50"
                    >
                      {couponLoading ? "Validando..." : "Aplicar"}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Check className="w-4 h-4" />
                      <span>{appliedCoupon.code}: -$${appliedCoupon.discountUsd.toFixed(2)} USD</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-[11px] underline hover:text-emerald-700"
                    >
                      Quitar
                    </button>
                  </div>
                )}

                {couponMessage && !appliedCoupon && (
                  <p className="text-[11px] text-destructive font-medium">
                    {couponMessage}
                  </p>
                )}
              </div>

              {/* Order live breakdown summary */}
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs space-y-1.5">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal productos:</span>
                  <span>{formatCurrency(subtotalUsd, "USD")}</span>
                </div>

                {appliedCoupon && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Descuento cupón ({appliedCoupon.code}):</span>
                    <span>-{formatCurrency(discountUsd, "USD")}</span>
                  </div>
                )}

                {deliveryType === "DELIVERY" && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delivery ({selectedZone?.name}):</span>
                    <span>
                      {deliveryFeeUsd === 0 ? "GRATIS" : formatCurrency(deliveryFeeUsd, "USD")}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-border flex justify-between items-baseline font-black text-sm">
                  <span>Total a Pagar:</span>
                  <div className="text-right">
                    <span className="text-primary font-bold text-base">
                      {formatCurrency(totalUsd, "USD")}
                    </span>
                    <span className="block text-xs font-semibold text-muted-foreground">
                      Bs. {totalVes.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!customerName.trim() || !customerPhone.trim()) {
                    setError("Completa tu nombre y teléfono antes de continuar");
                    return;
                  }
                  if (deliveryType === "DELIVERY" && !deliveryAddress.trim()) {
                    setError("Indica la dirección para el despacho");
                    return;
                  }
                  const minOrder = settings.operational_settings?.min_order_usd || 0;
                  if (minOrder > 0 && subtotalUsd < minOrder) {
                    setError(`El monto mínimo de compra en la tienda es de $${minOrder.toFixed(2)} USD.`);
                    return;
                  }
                  setError(null);
                  setStep("PAYMENT");
                }}
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-transform active:scale-[0.98]"
              >
                Continuar al Pago
              </button>
            </>
          ) : (
            <>
              {/* Step 2: Payment */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Selecciona Método de Pago
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {availablePaymentMethods.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        activePaymentMethod === m.id
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border bg-background hover:bg-muted"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shop Account Instructions with 1-Click Copy */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border text-xs space-y-3">
                <div className="font-bold text-foreground flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-primary" />
                    <span>Datos de Pago {settings.business_name}</span>
                  </div>
                  <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
                    {activePaymentMethod === "PAGO_MOVIL"
                      ? `${pmData.bank}`
                      : activePaymentMethod === "BANK_TRANSFER"
                      ? `${btData.bank}`
                      : activePaymentMethod === "ZELLE"
                      ? "Zelle USD"
                      : "Efectivo"}
                  </span>
                </div>

                {activePaymentMethod === "PAGO_MOVIL" && (
                  <div className="space-y-2 pt-1">
                    {/* Banco */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                          Banco Receptor
                        </span>
                        <span className="font-bold text-xs text-foreground">
                          {pmData.bank}
                        </span>
                      </div>
                    </div>

                    {/* Teléfono */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                          Teléfono
                        </span>
                        <span className="font-mono font-bold text-xs text-foreground">
                          {pmData.phone}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(pmData.phone.replace(/\D/g, ""), "phone")}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          copiedField === "phone"
                            ? "bg-emerald-600 text-white"
                            : "bg-muted hover:bg-primary hover:text-primary-foreground text-foreground border border-border"
                        }`}
                      >
                        {copiedField === "phone" ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* RIF */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                          RIF / Cédula / Titular
                        </span>
                        <span className="font-mono font-bold text-xs text-foreground">
                          {pmData.id_doc} {pmData.name ? `(${pmData.name})` : ""}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(pmData.id_doc.replace(/[^A-Za-z0-9]/g, ""), "rif")}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          copiedField === "rif"
                            ? "bg-emerald-600 text-white"
                            : "bg-muted hover:bg-primary hover:text-primary-foreground text-foreground border border-border"
                        }`}
                      >
                        {copiedField === "rif" ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Monto exacto Bs */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-primary/10 border border-primary/30">
                      <div>
                        <span className="text-[10px] text-primary uppercase font-bold block">
                          Monto exacto a transferir
                        </span>
                        <span className="font-mono font-black text-sm text-foreground">
                          Bs.{" "}
                          {totalVes.toLocaleString("es-VE", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(totalVes.toFixed(2), "amount_ves")
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs ${
                          copiedField === "amount_ves"
                            ? "bg-emerald-600 text-white"
                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                        }`}
                      >
                        {copiedField === "amount_ves" ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar Monto</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {activePaymentMethod === "BANK_TRANSFER" && (
                  <div className="space-y-2 pt-1">
                    {/* N° Cuenta */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                          N° Cuenta {btData.account_type || "Corriente"} ({btData.bank})
                        </span>
                        <span className="font-mono font-bold text-xs text-foreground tracking-wide">
                          {btData.account_number}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(btData.account_number.replace(/\D/g, ""), "bank_account")
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          copiedField === "bank_account"
                            ? "bg-emerald-600 text-white"
                            : "bg-muted hover:bg-primary hover:text-primary-foreground text-foreground border border-border"
                        }`}
                      >
                        {copiedField === "bank_account" ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* RIF */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                          RIF / Titular
                        </span>
                        <span className="font-mono font-bold text-xs text-foreground">
                          {btData.id_doc} ({btData.name || settings.business_name})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(btData.id_doc.replace(/[^A-Za-z0-9]/g, ""), "bank_rif")}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          copiedField === "bank_rif"
                            ? "bg-emerald-600 text-white"
                            : "bg-muted hover:bg-primary hover:text-primary-foreground text-foreground border border-border"
                        }`}
                      >
                        {copiedField === "bank_rif" ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Monto exacto Bs */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-primary/10 border border-primary/30">
                      <div>
                        <span className="text-[10px] text-primary uppercase font-bold block">
                          Monto a transferir
                        </span>
                        <span className="font-mono font-black text-sm text-foreground">
                          Bs.{" "}
                          {totalVes.toLocaleString("es-VE", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(totalVes.toFixed(2), "bank_amount")
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs ${
                          copiedField === "bank_amount"
                            ? "bg-emerald-600 text-white"
                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                        }`}
                      >
                        {copiedField === "bank_amount" ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar Monto</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {activePaymentMethod === "ZELLE" && (
                  <div className="space-y-2 pt-1">
                    {/* Correo Zelle */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                          Correo Zelle
                        </span>
                        <span className="font-mono font-bold text-xs text-foreground">
                          {zelleData.email}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(zelleData.email, "zelle_email")
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          copiedField === "zelle_email"
                            ? "bg-emerald-600 text-white"
                            : "bg-muted hover:bg-primary hover:text-primary-foreground text-foreground border border-border"
                        }`}
                      >
                        {copiedField === "zelle_email" ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Titular */}
                    <div className="p-2.5 rounded-xl bg-background border border-border">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                        Titular de la Cuenta
                      </span>
                      <span className="font-bold text-xs text-foreground">
                        {zelleData.name || settings.business_name}
                      </span>
                    </div>

                    {/* Monto exacto USD */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-primary/10 border border-primary/30">
                      <div>
                        <span className="text-[10px] text-primary uppercase font-bold block">
                          Monto exacto USD
                        </span>
                        <span className="font-mono font-black text-sm text-foreground">
                          {formatCurrency(totalUsd, "USD")}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(totalUsd.toFixed(2), "zelle_amount")
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs ${
                          copiedField === "zelle_amount"
                            ? "bg-emerald-600 text-white"
                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                        }`}
                      >
                        {copiedField === "zelle_amount" ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar Monto</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {activePaymentMethod === "CASH_USD" && (
                  <div className="text-muted-foreground leading-relaxed pt-1 p-3 rounded-xl bg-background border border-border">
                    <p className="font-semibold text-foreground">
                      💵 Pago contra entrega / en tienda física:
                    </p>
                    <p className="mt-1 text-[11px]">
                      {cashInstructions}
                    </p>
                  </div>
                )}
              </div>

              {/* Proof fields and R2 file upload */}
              {(paymentMethod === "PAGO_MOVIL" ||
                paymentMethod === "BANK_TRANSFER" ||
                paymentMethod === "ZELLE") && (
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Datos del Comprobante
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="h-11 px-3 rounded-xl border border-input bg-background text-xs focus:ring-2 focus:ring-primary"
                    >
                      <option value="Bancamiga">Bancamiga</option>
                      <option value="Banesco">Banesco</option>
                      <option value="Mercantil">Mercantil</option>
                      <option value="BBVA Provincial">BBVA Provincial</option>
                      <option value="BDV">Banco de Venezuela</option>
                      <option value="Otro">Otro Banco</option>
                    </select>

                    <input
                      type="text"
                      required
                      placeholder="N° Referencia (4 a 6 dígitos)"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      className="h-11 px-3 rounded-xl border border-input bg-background text-xs focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {/* Cloudflare R2 Proof Screenshot Upload */}
                  <div className="pt-1">
                    <label className="text-xs font-medium text-foreground block mb-1">
                      Adjuntar Captura / Screenshot (Opcional - R2 Storage)
                    </label>
                    <div className="flex items-center gap-3">
                      <label
                        htmlFor={fileInputId}
                        className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-input bg-muted/40 hover:bg-muted text-xs font-medium text-muted-foreground transition-colors"
                      >
                        <Upload className="w-4 h-4 text-primary" />
                        <span>{proofFile ? proofFile.name : "Subir comprobante"}</span>
                      </label>
                      <input
                        id={fileInputId}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="sr-only"
                      />
                      {proofPreview && (
                        <div className="text-[11px] text-emerald-600 font-medium">
                          ✓ Foto lista
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep("DETAILS")}
                  className="w-1/3 h-11 rounded-xl border border-border text-foreground text-xs font-bold hover:bg-muted flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Atrás</span>
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-2/3 h-11 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-transform active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Procesando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar Pedido</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
