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
  const [paymentMethod, setPaymentMethod] = useState<
    "PAGO_MOVIL" | "BANK_TRANSFER" | "ZELLE" | "CASH_USD"
  >("PAGO_MOVIL");
  const [bankName, setBankName] = useState("Bancamiga");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  if (!isOpen) return null;

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
        {/* Modal Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              Finalizar Pedido
            </h2>
            <p className="text-xs text-muted-foreground">
              {step === "DETAILS"
                ? "Paso 1 de 2: Entrega y Promociones"
                : "Paso 2 de 2: Pago y Comprobante"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
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
                  {[
                    { id: "PAGO_MOVIL", label: "Pago Móvil" },
                    { id: "BANK_TRANSFER", label: "Transferencia Bs." },
                    { id: "ZELLE", label: "Zelle USD" },
                    { id: "CASH_USD", label: "Efectivo Tienda" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        paymentMethod === m.id
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border bg-background hover:bg-muted"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shop Market Account Instructions */}
              <div className="p-3.5 rounded-xl bg-muted/50 border border-border text-xs space-y-1">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-primary" />
                  <span>Datos de Pago Shop Market C.A.</span>
                </div>
                {paymentMethod === "PAGO_MOVIL" && (
                  <div className="text-muted-foreground leading-relaxed pt-1">
                    <p><strong>Banco:</strong> Bancamiga (0172) o Banesco (0134)</p>
                    <p><strong>Teléfono:</strong> 0424-5919577</p>
                    <p><strong>RIF:</strong> J-50123456-7</p>
                    <p className="text-primary font-bold mt-1">
                      Monto exacto: Bs. {totalVes.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
                {paymentMethod === "BANK_TRANSFER" && (
                  <div className="text-muted-foreground leading-relaxed pt-1">
                    <p><strong>Banco:</strong> Bancamiga Cta Corriente</p>
                    <p><strong>N° Cuenta:</strong> 0172-0111-55-1100012345</p>
                    <p><strong>Titular:</strong> Shop Market C.A.</p>
                    <p className="text-primary font-bold mt-1">
                      Monto: Bs. {totalVes.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
                {paymentMethod === "ZELLE" && (
                  <div className="text-muted-foreground leading-relaxed pt-1">
                    <p><strong>Zelle:</strong> shopmarketca@gmail.com</p>
                    <p><strong>Titular:</strong> Shop Market C.A.</p>
                    <p className="text-primary font-bold mt-1">
                      Monto exacto: {formatCurrency(totalUsd, "USD")}
                    </p>
                  </div>
                )}
                {paymentMethod === "CASH_USD" && (
                  <div className="text-muted-foreground leading-relaxed pt-1">
                    <p>Pagas en efectivo al momento del retiro en tienda o al repartidor del delivery.</p>
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
                  className="w-1/3 h-11 rounded-xl border border-border text-foreground text-xs font-semibold hover:bg-muted"
                >
                  Atrás
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
