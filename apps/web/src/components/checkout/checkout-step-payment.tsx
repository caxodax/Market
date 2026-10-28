"use client";

import React from "react";
import { TenantSettings } from "@marketos/types";
import { formatCurrency, formatFileSize } from "@marketos/utils";
import { PagoMovilCard } from "@marketos/plugin-local-venezuela";
import {
  CreditCard,
  QrCode,
  Tag,
  Upload,
  Check,
  Copy,
  ArrowLeft,
  FileText,
  Receipt,
  Loader2,
} from "lucide-react";

export interface CheckoutStepPaymentProps {
  customerName: string;
  deliveryType: "PICKUP" | "DELIVERY";
  onBack: () => void;
  itemsCount: number;
  subtotalUsd: number;
  appliedCoupon: {
    code: string;
    discountUsd: number;
    description?: string | null;
  } | null;
  discountUsd: number;
  deliveryFeeUsd: number;
  selectedZoneName?: string;
  isDeliveryActive: boolean;
  totalUsd: number;
  totalVes: number;
  isVenezuelaActive: boolean;
  isCouponsActive: boolean;
  couponCode: string;
  setCouponCode: (v: string) => void;
  couponLoading: boolean;
  couponMessage: { text: string; type: "success" | "error" } | null;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;
  paymentMethod: "PAGO_MOVIL" | "BANK_TRANSFER" | "ZELLE" | "CASH_USD";
  setPaymentMethod: (v: "PAGO_MOVIL" | "BANK_TRANSFER" | "ZELLE" | "CASH_USD") => void;
  availablePaymentMethods: {
    id: "PAGO_MOVIL" | "BANK_TRANSFER" | "ZELLE" | "CASH_USD";
    label: string;
    icon: React.ReactNode;
  }[];
  settings: TenantSettings;
  exchangeRate: number;
  pmData: any;
  btData: any;
  zelleData: any;
  copiedField: string | null;
  onCopy: (text: string, fieldId: string) => void;
  cashInstructions: string;
  cashTenderedInput: string;
  setCashTenderedInput: (v: string) => void;
  bankName: string;
  setBankName: (v: string) => void;
  referenceNumber: string;
  setReferenceNumber: (v: string) => void;
  fileInputId: string;
  isCompressingProof: boolean;
  proofFile: File | null;
  proofPreview: string | null;
  proofCompressionInfo: {
    originalSize: number;
    compressedSize: number;
    savedPercent: number;
  } | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function CheckoutStepPayment({
  customerName,
  deliveryType,
  onBack,
  itemsCount,
  subtotalUsd,
  appliedCoupon,
  discountUsd,
  deliveryFeeUsd,
  selectedZoneName,
  isDeliveryActive,
  totalUsd,
  totalVes,
  isVenezuelaActive,
  isCouponsActive,
  couponCode,
  setCouponCode,
  couponLoading,
  couponMessage,
  onApplyCoupon,
  onRemoveCoupon,
  paymentMethod,
  setPaymentMethod,
  availablePaymentMethods,
  settings,
  exchangeRate,
  pmData,
  btData,
  zelleData,
  copiedField,
  onCopy,
  cashInstructions,
  cashTenderedInput,
  setCashTenderedInput,
  bankName,
  setBankName,
  referenceNumber,
  setReferenceNumber,
  fileInputId,
  isCompressingProof,
  proofFile,
  proofPreview,
  proofCompressionInfo,
  onFileChange,
}: CheckoutStepPaymentProps) {
  const activePaymentMethod = paymentMethod;
  const baseCurrency = settings.currency_settings?.base_currency || "USD";

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Back button and recipient pill */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>← Volver a Datos</span>
        </button>
        <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[200px]">
          {customerName} • {deliveryType === "DELIVERY" ? "Delivery" : "Retiro"}
        </span>
      </div>

      {/* Order Financial Breakdown Card */}
      <div className="p-4 rounded-2xl bg-muted/40 border border-border text-xs space-y-2">
        <div className="flex items-center justify-between font-bold text-foreground pb-1 border-b border-border/60">
          <span className="flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-primary" />
            Resumen del Pedido
          </span>
          <span className="text-[11px] text-muted-foreground font-normal">
            {itemsCount} {itemsCount === 1 ? "artículo" : "artículos"}
          </span>
        </div>

        <div className="flex justify-between text-muted-foreground pt-1">
          <span>Subtotal productos:</span>
          <span className="font-semibold text-foreground">
            {formatCurrency(subtotalUsd, baseCurrency)}
          </span>
        </div>

        {appliedCoupon && (
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
            <span>Cupón ({appliedCoupon.code}):</span>
            <span>-{formatCurrency(discountUsd, baseCurrency)}</span>
          </div>
        )}

        {isDeliveryActive && deliveryType === "DELIVERY" && (
          <div className="flex justify-between text-muted-foreground">
            <span>Delivery ({selectedZoneName}):</span>
            <span className="font-semibold text-foreground">
              {deliveryFeeUsd === 0
                ? "GRATIS"
                : formatCurrency(deliveryFeeUsd, baseCurrency)}
            </span>
          </div>
        )}

        <div className="pt-2 border-t border-border flex justify-between items-baseline font-black">
          <span className="text-foreground text-sm">Total a Pagar:</span>
          <div className="text-right">
            <span className="text-primary font-bold text-lg">
              {formatCurrency(totalUsd, baseCurrency)}
            </span>
            {isVenezuelaActive && (
              <span className="block text-xs font-semibold text-muted-foreground font-mono">
                Bs.{" "}
                {totalVes.toLocaleString("es-VE", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Coupon / Discount Code Section */}
      {isCouponsActive && (
        <div className="p-3.5 rounded-2xl bg-muted/20 border border-border space-y-2">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-primary" />
            ¿Tienes un Cupón de Descuento?
          </label>

          {!appliedCoupon ? (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ej. BIENVENIDO o PROMO10"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="flex-1 h-10 px-3 rounded-xl border border-input bg-background text-xs uppercase font-mono tracking-wider focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                disabled={couponLoading || !couponCode.trim()}
                onClick={onApplyCoupon}
                className="px-4 h-10 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/80 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {couponLoading ? "Validando..." : "Aplicar"}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
              <div className="flex items-center gap-1.5 font-bold">
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>
                  {appliedCoupon.code}: -${appliedCoupon.discountUsd.toFixed(2)} USD
                </span>
              </div>
              <button
                type="button"
                onClick={onRemoveCoupon}
                className="text-[11px] font-semibold underline hover:text-emerald-700 cursor-pointer"
              >
                Quitar
              </button>
            </div>
          )}

          {couponMessage && !appliedCoupon && (
            <p
              className={`text-[11px] font-medium ${
                couponMessage.type === "success"
                  ? "text-emerald-600"
                  : "text-destructive"
              }`}
            >
              {couponMessage.text}
            </p>
          )}
        </div>
      )}

      {/* Payment Method Selector Grid */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold text-foreground uppercase tracking-wider block">
          Selecciona tu Método de Pago
        </label>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {availablePaymentMethods.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setPaymentMethod(m.id)}
              className={`min-h-[50px] p-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activePaymentMethod === m.id
                  ? "border-primary bg-primary/10 text-primary font-bold shadow-xs ring-1 ring-primary/40"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              {m.icon}
              <span className="text-xs">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Account Details & Instructions with 1-Click Copy */}
      <div className="p-4 rounded-2xl bg-muted/40 border border-border text-xs space-y-3">
        <div className="font-bold text-foreground flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <QrCode className="w-4 h-4 text-primary" />
            <span>Datos de Pago ({settings.business_name})</span>
          </div>
          <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
            {activePaymentMethod === "PAGO_MOVIL"
              ? `${pmData.bank || "Pago Móvil"}`
              : activePaymentMethod === "BANK_TRANSFER"
              ? `${btData.bank || "Transferencia"}`
              : activePaymentMethod === "ZELLE"
              ? "Zelle USD"
              : "Efectivo"}
          </span>
        </div>

        {/* Pago Móvil Details */}
        {activePaymentMethod === "PAGO_MOVIL" && (
          <PagoMovilCard
            data={pmData}
            amountBs={totalVes}
            exchangeRate={exchangeRate}
          />
        )}

        {/* Bank Transfer Details */}
        {activePaymentMethod === "BANK_TRANSFER" && (
          <div className="space-y-2 pt-1">
            {/* Account Number */}
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
                  onCopy(
                    btData.account_number.replace(/\D/g, ""),
                    "bank_account"
                  )
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
                onClick={() =>
                  onCopy(
                    btData.id_doc.replace(/[^A-Za-z0-9]/g, ""),
                    "bank_rif"
                  )
                }
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

            {/* Exact amount in VES */}
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
                onClick={() => onCopy(totalVes.toFixed(2), "bank_amount")}
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

        {/* Zelle Details */}
        {activePaymentMethod === "ZELLE" && (
          <div className="space-y-2 pt-1">
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
                onClick={() => onCopy(zelleData.email, "zelle_email")}
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

            <div className="p-2.5 rounded-xl bg-background border border-border">
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                Titular de la Cuenta
              </span>
              <span className="font-bold text-xs text-foreground">
                {zelleData.name || settings.business_name}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-primary/10 border border-primary/30">
              <div>
                <span className="text-[10px] text-primary uppercase font-bold block">
                  Monto exacto {baseCurrency}
                </span>
                <span className="font-mono font-black text-sm text-foreground">
                  {formatCurrency(totalUsd, baseCurrency)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onCopy(totalUsd.toFixed(2), "zelle_amount")}
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

        {/* Cash Details */}
        {activePaymentMethod === "CASH_USD" && (
          <div className="text-muted-foreground leading-relaxed pt-1 p-3.5 rounded-2xl bg-background border border-border space-y-3">
            <div>
              <p className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                <Receipt className="w-3.5 h-3.5 text-amber-500" />
                Pago en efectivo contra entrega / tienda física:
              </p>
              <p className="mt-1 text-[11px]">{cashInstructions}</p>
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-between font-bold text-foreground">
              <span className="text-xs">Total exacto de la orden:</span>
              <span className="font-mono text-primary font-black text-sm">
                {formatCurrency(totalUsd, baseCurrency)}
              </span>
            </div>

            {/* Cash Tendered & Change calculator */}
            <div className="pt-2 border-t border-border space-y-2">
              <label className="block text-[11px] font-bold text-foreground">
                💵 ¿Con qué denominación o billete pagarás? (Opcional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">
                  $
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={totalUsd}
                  placeholder={totalUsd.toFixed(2)}
                  value={cashTenderedInput}
                  onChange={(e) => setCashTenderedInput(e.target.value)}
                  className="w-full h-11 pl-7 pr-3 rounded-xl border border-input bg-card text-xs font-mono font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              {/* Quick bill denominations chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[5, 10, 20, 50, 100].filter((val) => val >= totalUsd).slice(0, 4).map((bill) => (
                  <button
                    key={bill}
                    type="button"
                    onClick={() => {
                      setCashTenderedInput(bill.toString());
                      if (typeof window !== "undefined" && "vibrate" in navigator) {
                        try { navigator.vibrate(10); } catch {}
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition-all cursor-pointer ${
                      cashTenderedInput === bill.toString()
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted text-foreground border-border"
                    }`}
                  >
                    ${bill} USD
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setCashTenderedInput(totalUsd.toFixed(2));
                    if (typeof window !== "undefined" && "vibrate" in navigator) {
                      try { navigator.vibrate(10); } catch {}
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-border bg-background hover:bg-muted text-muted-foreground transition-all cursor-pointer"
                >
                  Monto exacto
                </button>
              </div>

              {parseFloat(cashTenderedInput) > totalUsd && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center justify-between animate-fadeIn">
                  <span className="font-semibold">🔄 Cambio que debe llevar el repartidor:</span>
                  <span className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-200">
                    ${(parseFloat(cashTenderedInput) - totalUsd).toFixed(2)} USD
                  </span>
                </div>
              )}
              {parseFloat(cashTenderedInput) < totalUsd && parseFloat(cashTenderedInput) > 0 && (
                <p className="text-[11px] text-destructive font-semibold">
                  ⚠️ El monto ingresado (${parseFloat(cashTenderedInput).toFixed(2)}) no cubre el total del pedido (${totalUsd.toFixed(2)}).
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Proof fields and R2 file upload (for electronic payments) */}
      {(paymentMethod === "PAGO_MOVIL" ||
        paymentMethod === "BANK_TRANSFER" ||
        paymentMethod === "ZELLE") && (
        <div className="space-y-3 p-3.5 rounded-2xl bg-muted/20 border border-border">
          <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-primary" />
            Datos del Comprobante
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-foreground/80 mb-1">
                Banco Emisor
              </label>
              <select
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-input bg-background text-xs font-medium focus:ring-2 focus:ring-primary cursor-pointer"
              >
                <option value="Bancamiga">Bancamiga</option>
                <option value="Banesco">Banesco</option>
                <option value="Mercantil">Mercantil</option>
                <option value="BBVA Provincial">BBVA Provincial</option>
                <option value="BDV">Banco de Venezuela</option>
                <option value="Bancaribe">Bancaribe</option>
                <option value="BNC">BNC</option>
                <option value="Otro">Otro Banco</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-foreground/80 mb-1">
                N° Referencia *
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                required
                placeholder="Últimos 4 a 6 dígitos"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value.replace(/\D/g, ""))}
                className="w-full h-11 px-3 rounded-xl border border-input bg-background text-xs font-mono font-medium focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Cloudflare R2 Proof Screenshot Upload with WebP compression */}
          <div className="pt-1">
            <label className="text-[11px] font-semibold text-foreground/80 block mb-1">
              Adjuntar Captura / Screenshot (Opcional)
            </label>
            <div className="flex flex-wrap items-center gap-2.5">
              <label
                htmlFor={fileInputId}
                className={`cursor-pointer flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-dashed border-input bg-background hover:bg-muted text-xs font-medium text-foreground transition-all active:scale-[0.98] ${
                  isCompressingProof ? "opacity-60 pointer-events-none" : ""
                }`}
              >
                {isCompressingProof ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 text-primary" />
                )}
                <span>
                  {isCompressingProof
                    ? "Optimizando imagen..."
                    : proofFile
                    ? proofFile.name
                    : "Subir comprobante"}
                </span>
              </label>
              <input
                id={fileInputId}
                type="file"
                accept="image/*"
                onChange={onFileChange}
                disabled={isCompressingProof}
                className="sr-only"
              />

              {proofPreview && !isCompressingProof && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>
                    {proofCompressionInfo
                      ? `WebP (${formatFileSize(
                          proofCompressionInfo.compressedSize
                        )})`
                      : "Comprobante listo"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
