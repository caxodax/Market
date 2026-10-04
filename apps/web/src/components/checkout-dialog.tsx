"use client";

import React, { useState } from "react";
import { Store, TenantSettings, Order } from "@marketos/types";
import { useCart } from "../context/cart-context";
import { formatCurrency, convertUsdToVes } from "@marketos/utils";
import { createOrderAction, submitPaymentProofAction } from "../app/actions";
import {
  X,
  CreditCard,
  Truck,
  Store as StoreIcon,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Loader2,
} from "lucide-react";

interface CheckoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TenantSettings;
  stores: Store[];
  exchangeRate: number;
  onOrderCompleted: (order: Order) => void;
}

export function CheckoutDialog({
  isOpen,
  onClose,
  settings,
  stores,
  exchangeRate,
  onOrderCompleted,
}: CheckoutDialogProps) {
  const { items, totalUsd, clearCart } = useCart();

  const [step, setStep] = useState<"DETAILS" | "PAYMENT">("DETAILS");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryType, setDeliveryType] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"PAGO_MOVIL" | "BANK_TRANSFER" | "ZELLE" | "CASH_USD">("PAGO_MOVIL");
  const [bankName, setBankName] = useState("Bancamiga");
  const [referenceNumber, setReferenceNumber] = useState("");

  if (!isOpen) return null;

  const totalVes = convertUsdToVes(totalUsd, exchangeRate);
  const selectedStore = stores[0] || { id: "default-store", name: "Shop Market Nueva Segovia" };

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

    if ((paymentMethod === "PAGO_MOVIL" || paymentMethod === "BANK_TRANSFER") && !referenceNumber.trim()) {
      setError("Por favor ingresa los últimos 4 o 6 dígitos de tu número de referencia");
      return;
    }

    setLoading(true);

    try {
      // 1. Create order
      const orderRes = await createOrderAction({
        tenantId: settings.tenant_id,
        storeId: selectedStore.id,
        customerName,
        customerPhone,
        deliveryType,
        deliveryAddress: deliveryType === "DELIVERY" ? deliveryAddress : undefined,
        items: items.map((i) => ({
          productId: i.product.id,
          productName: i.product.name,
          quantity: i.quantity,
          unitPriceUsd: i.product.price_usd,
        })),
        notes: `Método de pago: ${paymentMethod}`,
      });

      if (!orderRes.success || !orderRes.order) {
        throw new Error(orderRes.error || "No se pudo generar la orden");
      }

      // 2. Submit payment proof
      await submitPaymentProofAction({
        tenantId: settings.tenant_id,
        orderId: orderRes.order.id,
        method: paymentMethod,
        bankName,
        referenceNumber: referenceNumber || "PAGO_DIRECTO",
        amount: paymentMethod === "ZELLE" || paymentMethod === "CASH_USD" ? totalUsd : totalVes,
        currency: paymentMethod === "ZELLE" || paymentMethod === "CASH_USD" ? "USD" : "VES",
      });

      clearCart();
      onClose();
      onOrderCompleted(orderRes.order);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Error inesperado al procesar el pago");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Finalizar Pedido — Shop Market C.A.
            </h3>
            <p className="text-xs text-muted-foreground">
              Paso {step === "DETAILS" ? "1 de 2: Datos de Entrega" : "2 de 2: Comprobante de Pago"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {step === "DETAILS" ? (
            <>
              {/* Customer Info */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Tus Datos de Contacto
                </label>
                <div>
                  <input
                    type="text"
                    required
                    placeholder="Nombre y Apellido"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <input
                    type="tel"
                    required
                    placeholder="Teléfono WhatsApp (ej. 04245919577)"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Delivery method */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Método de Entrega
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDeliveryType("PICKUP")}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-center transition-all ${
                      deliveryType === "PICKUP"
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border bg-background hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <StoreIcon className="w-5 h-5" />
                    <span className="text-xs">Retiro en Tienda</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryType("DELIVERY")}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-center transition-all ${
                      deliveryType === "DELIVERY"
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border bg-background hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <Truck className="w-5 h-5" />
                    <span className="text-xs">Delivery a Domicilio</span>
                  </button>
                </div>

                {deliveryType === "DELIVERY" && (
                  <div className="mt-2">
                    <textarea
                      rows={2}
                      required
                      placeholder="Dirección completa y punto de referencia en Barquisimeto..."
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="w-full p-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}
              </div>

              {/* Summary banner */}
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Total a pagar:</span>
                <div className="text-right">
                  <span className="font-extrabold text-foreground text-sm">
                    {formatCurrency(totalUsd, "USD")}
                  </span>
                  <span className="ml-1.5 text-primary font-semibold">
                    (Bs. {totalVes.toLocaleString("es-VE", { minimumFractionDigits: 2 })})
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!customerName || !customerPhone) {
                    setError("Completa tus datos de contacto antes de continuar");
                    return;
                  }
                  setError(null);
                  setStep("PAYMENT");
                }}
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all"
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
                    <p>Pagas en efectivo al momento del retiro en tienda o entrega del delivery.</p>
                  </div>
                )}
              </div>

              {/* Proof fields */}
              {(paymentMethod === "PAGO_MOVIL" || paymentMethod === "BANK_TRANSFER") && (
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
                      <span>Enviando...</span>
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
