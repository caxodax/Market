"use client";

import React, { useState } from "react";
import type {
  CreatePurchaseInvoiceInput,
  PurchaseInvoice,
  RetentionVoucher,
  TenantSettings,
  Supplier,
} from "@marketos/types";
import { formatCurrency } from "@marketos/utils";
import {
  X,
  Plus,
  Trash2,
  Building,
  Calendar,
  FileText,
  DollarSign,
  ShieldCheck,
  Loader2,
  AlertCircle,
} from "lucide-react";

export interface RegisterPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchaseRegistered: (
    input: CreatePurchaseInvoiceInput
  ) => Promise<{ success: boolean; error?: string; invoice?: PurchaseInvoice; voucher?: RetentionVoucher }>;
  settings: TenantSettings;
  activeModuleIds?: string[];
  existingSuppliers?: Supplier[];
  defaultExchangeRate?: number;
}

export function RegisterPurchaseModal({
  isOpen,
  onClose,
  onPurchaseRegistered,
  settings,
  activeModuleIds = [],
  existingSuppliers = [],
  defaultExchangeRate = 1,
}: RegisterPurchaseModalProps) {
  const isVenezuela = activeModuleIds.includes("local_venezuela");
  const isChile = activeModuleIds.includes("local_chile");

  // Form State
  const [supplierName, setSupplierName] = useState("");
  const [supplierTaxId, setSupplierTaxId] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [controlNumber, setControlNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [currency, setCurrency] = useState<"USD" | "EUR" | "CLP" | "VES">(
    isChile ? "CLP" : settings.default_currency === "EUR" ? "EUR" : "USD"
  );
  const [exchangeRate, setExchangeRate] = useState<number>(defaultExchangeRate);
  const [notes, setNotes] = useState("");

  // Items State
  const [items, setItems] = useState<
    Array<{ name: string; quantity: number; unit_price: number; is_exempt?: boolean }>
  >([{ name: "", quantity: 1, unit_price: 0, is_exempt: false }]);

  // Retention Settings
  const [autoRetention, setAutoRetention] = useState(isVenezuela || isChile);
  const [retentionRate, setRetentionRate] = useState<number>(isChile ? 100 : 75);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Autocomplete supplier when selected
  const handleSelectExistingSupplier = (supId: string) => {
    const sup = existingSuppliers.find((s) => s.id === supId);
    if (sup) {
      setSupplierName(sup.name);
      setSupplierTaxId(sup.tax_id);
      setSupplierPhone(sup.phone || "");
      setSupplierAddress(sup.address || "");
      if (sup.default_retention_rate) {
        setRetentionRate(sup.default_retention_rate);
      }
    }
  };

  const addItemRow = () => {
    setItems((prev) => [...prev, { name: "", quantity: 1, unit_price: 0, is_exempt: false }]);
  };

  const removeItemRow = (idx: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (
    index: number,
    field: "name" | "quantity" | "unit_price" | "is_exempt",
    value: any
  ) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Calculations
  const defaultIvaPercent = isChile ? 19.0 : 16.0;
  let subtotalExempt = 0;
  let subtotalTaxable = 0;

  for (const it of items) {
    const total = Number(((it.quantity || 0) * (it.unit_price || 0)).toFixed(2));
    if (it.is_exempt) subtotalExempt += total;
    else subtotalTaxable += total;
  }

  const ivaAmount = Number(((subtotalTaxable * defaultIvaPercent) / 100).toFixed(2));
  const totalAmount = Number((subtotalExempt + subtotalTaxable + ivaAmount).toFixed(2));
  const retainedVat = autoRetention ? Number(((ivaAmount * retentionRate) / 100).toFixed(2)) : 0;
  const netPayableToSupplier = Number((totalAmount - retainedVat).toFixed(2));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!supplierName.trim()) {
      setError("El nombre o razón social del proveedor es obligatorio.");
      return;
    }
    if (!supplierTaxId.trim()) {
      setError("El RIF / RUT o documento fiscal del proveedor es obligatorio.");
      return;
    }
    if (!invoiceNumber.trim()) {
      setError("El número de factura del proveedor es obligatorio.");
      return;
    }
    if (items.some((it) => !it.name.trim() || it.quantity <= 0)) {
      setError("Todos los ítems deben tener descripción válida y cantidad mayor a cero.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await onPurchaseRegistered({
        supplier_name: supplierName.trim(),
        supplier_tax_id: supplierTaxId.trim().toUpperCase(),
        supplier_phone: supplierPhone.trim() || null,
        supplier_address: supplierAddress.trim() || null,
        invoice_number: invoiceNumber.trim().toUpperCase(),
        control_number: controlNumber.trim() ? controlNumber.trim() : null,
        invoice_date: invoiceDate,
        currency,
        exchange_rate_applied: exchangeRate > 0 ? exchangeRate : undefined,
        notes: notes.trim() || null,
        items,
        auto_generate_retention: autoRetention && ivaAmount > 0,
        retention_rate_percent: retentionRate,
        retention_type: isChile ? "CHILE_DTE_46" : "VAT",
      });

      if (res.success) {
        onClose();
      } else {
        setError(res.error || "Ocurrió un error al registrar la compra.");
      }
    } catch (err: any) {
      setError(err?.message || "Error al procesar la factura de compra.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground">
                Registrar Factura de Proveedor
              </h2>
              <p className="text-xs text-muted-foreground">
                Control de compras y emisión de comprobantes de retención
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Supplier Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                <Building className="w-3.5 h-3.5 text-primary" />
                <span>Datos del Proveedor</span>
              </label>
              {existingSuppliers.length > 0 && (
                <select
                  aria-label="Seleccionar proveedor guardado"
                  onChange={(e) => handleSelectExistingSupplier(e.target.value)}
                  className="text-xs bg-muted border border-border rounded-lg px-2 py-1 text-foreground"
                >
                  <option value="">Seleccionar proveedor guardado...</option>
                  {existingSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.tax_id})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Razón Social / Nombre *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Distribuidora Los Andes C.A."
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-background border border-border rounded-xl text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  {isChile ? "RUT del Proveedor *" : "RIF del Proveedor *"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isChile ? "76.123.456-7" : "J-12345678-0"}
                  value={supplierTaxId}
                  onChange={(e) => setSupplierTaxId(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-background border border-border rounded-xl text-foreground font-mono focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Teléfono de Contacto
                </label>
                <input
                  type="text"
                  placeholder="+58 412-1234567"
                  value={supplierPhone}
                  onChange={(e) => setSupplierPhone(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-background border border-border rounded-xl text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Dirección Fiscal
                </label>
                <input
                  type="text"
                  placeholder="Zona Industrial, Calle 4"
                  value={supplierAddress}
                  onChange={(e) => setSupplierAddress(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-background border border-border rounded-xl text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          {/* Invoice Document Details */}
          <div className="space-y-3 pt-3 border-t border-border/60">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>Datos de la Factura de Compra</span>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  N° Factura Proveedor *
                </label>
                <input
                  type="text"
                  required
                  placeholder="0004589"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-background border border-border rounded-xl text-foreground font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {isVenezuela && (
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    N° Control SENIAT
                  </label>
                  <input
                    type="text"
                    placeholder="00-001245"
                    value={controlNumber}
                    onChange={(e) => setControlNumber(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-background border border-border rounded-xl text-foreground font-mono focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Fecha de Emisión *
                </label>
                <input
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-background border border-border rounded-xl text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-3 pt-3 border-t border-border/60">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                Ítems / Bienes o Servicios Adquiridos
              </label>
              <button
                type="button"
                onClick={addItemRow}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar Ítem</span>
              </button>
            </div>

            <div className="space-y-2">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/60"
                >
                  <div className="flex-1">
                    <input
                      type="text"
                      required
                      placeholder="Descripción del insumo o producto"
                      value={it.name}
                      onChange={(e) => updateItem(idx, "name", e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-foreground focus:outline-hidden"
                    />
                  </div>

                  <div className="w-20">
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="Cant."
                      value={it.quantity}
                      onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))}
                      className="w-full text-xs px-2 py-1.5 bg-background border border-border rounded-lg text-foreground text-center focus:outline-hidden"
                    />
                  </div>

                  <div className="w-28">
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      placeholder="Precio Unit."
                      value={it.unit_price}
                      onChange={(e) => updateItem(idx, "unit_price", Number(e.target.value))}
                      className="w-full text-xs px-2 py-1.5 bg-background border border-border rounded-lg text-foreground text-right font-mono focus:outline-hidden"
                    />
                  </div>

                  <label className="flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap cursor-pointer px-1">
                    <input
                      type="checkbox"
                      checked={Boolean(it.is_exempt)}
                      onChange={(e) => updateItem(idx, "is_exempt", e.target.checked)}
                      className="rounded text-primary focus:ring-0"
                    />
                    <span>Exento</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => removeItemRow(idx)}
                    disabled={items.length <= 1}
                    className="p-1.5 text-muted-foreground hover:text-destructive disabled:opacity-30 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Retention Options (SPE) */}
          <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-bold text-foreground">
                  Emitir Comprobante de Retención de IVA
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoRetention}
                onChange={(e) => setAutoRetention(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded focus:ring-0 cursor-pointer"
              />
            </div>

            {autoRetention && (
              <div className="flex items-center gap-4 text-xs pt-1 border-t border-purple-500/10">
                <span className="text-muted-foreground text-[11px]">Porcentaje a Retener:</span>
                <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                  <input
                    type="radio"
                    name="retRate"
                    value="75"
                    checked={retentionRate === 75}
                    onChange={() => setRetentionRate(75)}
                  />
                  <span>75% (General SPE)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                  <input
                    type="radio"
                    name="retRate"
                    value="100"
                    checked={retentionRate === 100}
                    onChange={() => setRetentionRate(100)}
                  />
                  <span>100% (SPE / Proveedor sin RIF)</span>
                </label>
              </div>
            )}
          </div>

          {/* Summary Breakdown */}
          <div className="p-4 rounded-xl bg-muted/60 border border-border space-y-1.5 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal Exento:</span>
              <span className="font-mono">{formatCurrency(subtotalExempt, currency)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Base Imponible ({defaultIvaPercent}% IVA):</span>
              <span className="font-mono">{formatCurrency(subtotalTaxable, currency)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Impuesto IVA ({defaultIvaPercent}%):</span>
              <span className="font-mono">{formatCurrency(ivaAmount, currency)}</span>
            </div>
            <div className="flex justify-between font-bold text-foreground border-t border-border pt-1">
              <span>TOTAL FACTURA PROVEEDOR:</span>
              <span className="font-mono text-sm">{formatCurrency(totalAmount, currency)}</span>
            </div>

            {autoRetention && (
              <>
                <div className="flex justify-between font-bold text-purple-600 border-t border-purple-500/20 pt-1">
                  <span>Retención IVA a Enterar al Fisco ({retentionRate}%):</span>
                  <span className="font-mono">-{formatCurrency(retainedVat, currency)}</span>
                </div>
                <div className="flex justify-between font-black text-emerald-600 border-t border-border pt-1">
                  <span>MONTO NETO A PAGAR AL PROVEEDOR:</span>
                  <span className="font-mono text-sm">{formatCurrency(netPayableToSupplier, currency)}</span>
                </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Registrar y Guardar</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
