"use client";

import React, { useState, useEffect } from "react";
import type {
  Order,
  FiscalDocument,
  FiscalDocumentType,
  CreateFiscalDocumentInput,
  TenantSettings,
} from "@marketos/types";
import { formatCurrency } from "@marketos/utils";
import { resolveFiscalAdapter } from "../adapters/fiscal-adapter";
import {
  FileText,
  RotateCcw,
  Truck,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  User,
  ShieldCheck,
  Receipt,
  HelpCircle,
} from "lucide-react";

export interface IssueDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentCreated: (input: CreateFiscalDocumentInput) => Promise<{ success: boolean; error?: string }>;
  settings: TenantSettings;
  activeModuleIds?: string[];
  initialOrder?: Order | null;
  initialType?: FiscalDocumentType;
  existingInvoices?: FiscalDocument[];
  availableDrivers?: Array<{ id: string; name: string; phone: string; vehicle_plate?: string }>;
}

export function IssueDocumentModal({
  isOpen,
  onClose,
  onDocumentCreated,
  settings,
  activeModuleIds = [],
  initialOrder,
  initialType = "INVOICE",
  existingInvoices = [],
  availableDrivers = [],
}: IssueDocumentModalProps) {
  const adapter = resolveFiscalAdapter(undefined, activeModuleIds);

  const [docType, setDocType] = useState<FiscalDocumentType>(initialType);
  const [selectedAffectedInvoiceId, setSelectedAffectedInvoiceId] = useState<string>("");
  const [returnItemsToInventory, setReturnItemsToInventory] = useState<boolean>(true);
  const [reason, setReason] = useState<string>("");

  // Customer Data
  const [customerName, setCustomerName] = useState<string>("");
  const [customerIdDoc, setCustomerIdDoc] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerAddress, setCustomerAddress] = useState<string>("");

  // Items
  const [items, setItems] = useState<
    Array<{
      product_id?: string;
      name: string;
      quantity: number;
      unit_price: number;
      is_exempt?: boolean;
    }>
  >([]);

  // Transport Data
  const [driverName, setDriverName] = useState<string>("");
  const [driverIdDoc, setDriverIdDoc] = useState<string>("");
  const [driverPhone, setDriverPhone] = useState<string>("");
  const [vehicleModel, setVehicleModel] = useState<string>("");
  const [vehiclePlate, setVehiclePlate] = useState<string>("");
  const [packagesCount, setPackagesCount] = useState<number>(1);
  const [transportReason, setTransportReason] = useState<string>("Venta y Entrega a Domicilio");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from initialOrder or initialType when opened
  useEffect(() => {
    if (!isOpen) return;

    setDocType(initialType);
    setError(null);

    if (initialOrder) {
      setCustomerName(initialOrder.customer_name || "");
      setCustomerIdDoc(initialOrder.customer_id_number || "");
      setCustomerPhone(initialOrder.customer_phone || "");
      setCustomerAddress(initialOrder.delivery_address || "");

      const mappedItems = (initialOrder.items || []).map((it) => ({
        product_id: it.product_id,
        name: it.product_name,
        quantity: it.quantity,
        unit_price: it.unit_price_usd,
        is_exempt: false,
      }));
      setItems(mappedItems.length > 0 ? mappedItems : [{ name: "", quantity: 1, unit_price: 0 }]);
    } else {
      setCustomerName("");
      setCustomerIdDoc("");
      setCustomerPhone("");
      setCustomerAddress("");
      setItems([{ name: "", quantity: 1, unit_price: 0 }]);
    }
  }, [isOpen, initialOrder, initialType]);

  // When selecting an affected invoice for Credit Note or Debit Note, auto-fill
  const handleSelectAffectedInvoice = (invoiceId: string) => {
    setSelectedAffectedInvoiceId(invoiceId);
    const found = existingInvoices.find((inv) => inv.id === invoiceId);
    if (found) {
      setCustomerName(found.customer_name);
      setCustomerIdDoc(found.customer_id_doc);
      setCustomerPhone(found.customer_phone || "");
      setCustomerAddress(found.customer_address || "");
      setItems(
        found.items.map((it) => ({
          product_id: it.product_id,
          name: it.name,
          quantity: it.quantity,
          unit_price: it.unit_price,
          is_exempt: it.is_exempt,
        }))
      );
    }
  };

  // Driver 1-click picker
  const handleSelectDriver = (driverId: string) => {
    const driver = availableDrivers.find((d) => d.id === driverId);
    if (driver) {
      setDriverName(driver.name);
      setDriverPhone(driver.phone);
      if (driver.vehicle_plate) setVehiclePlate(driver.vehicle_plate);
    }
  };

  if (!isOpen) return null;

  const isCreditOrDebit = docType === "CREDIT_NOTE" || docType === "DEBIT_NOTE";
  const isDispatchOrDelivery = docType === "DISPATCH_GUIDE" || docType === "DELIVERY_NOTE";

  // Calculations
  const subtotal = items.reduce((acc, it) => acc + (it.quantity || 0) * (it.unit_price || 0), 0);
  const iva = (subtotal * adapter.defaultIvaRate) / 100;
  const total = subtotal + iva;

  const handleAddItem = () => {
    setItems([...items, { name: "", quantity: 1, unit_price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerName.trim()) {
      setError("Por favor indica el nombre o razón social del cliente.");
      return;
    }

    if (!customerIdDoc.trim()) {
      setError(`El documento fiscal (${adapter.taxIdLabel}) del cliente es obligatorio.`);
      return;
    }

    if (items.some((it) => !it.name.trim() || it.quantity <= 0 || it.unit_price < 0)) {
      setError("Verifica los ítems: todos deben tener descripción, cantidad mayor a 0 y precio.");
      return;
    }

    let affectedNumber: string | undefined = undefined;
    if (isCreditOrDebit) {
      const inv = existingInvoices.find((i) => i.id === selectedAffectedInvoiceId);
      affectedNumber = inv?.document_number;
      if (!affectedNumber) {
        setError(`Para emitir una ${docType === "CREDIT_NOTE" ? "Nota de Crédito" : "Nota de Débito"} debes seleccionar la factura afectada.`);
        return;
      }
    }

    setLoading(true);

    try {
      const payload: CreateFiscalDocumentInput = {
        order_id: initialOrder?.id || null,
        document_type: docType,
        affected_document_id: selectedAffectedInvoiceId || null,
        affected_document_number: affectedNumber || null,
        reason: reason.trim() || null,
        return_items_to_inventory: docType === "CREDIT_NOTE" ? returnItemsToInventory : false,
        customer_name: customerName.trim(),
        customer_id_doc: customerIdDoc.trim().toUpperCase(),
        customer_phone: customerPhone.trim() || null,
        customer_address: customerAddress.trim() || null,
        items,
        currency: "USD",
        transport_info: isDispatchOrDelivery
          ? {
              driver_name: driverName.trim() || undefined,
              driver_id_doc: driverIdDoc.trim() || undefined,
              driver_phone: driverPhone.trim() || undefined,
              vehicle_model: vehicleModel.trim() || undefined,
              vehicle_plate: vehiclePlate.trim().toUpperCase() || undefined,
              packages_count: packagesCount || 1,
              transport_reason: transportReason,
            }
          : undefined,
      };

      const result = await onDocumentCreated(payload);
      if (result.success) {
        onClose();
      } else {
        setError(result.error || "No se pudo emitir el documento fiscal.");
      }
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error al procesar el documento.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Emitir Documento Fiscal"
    >
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-foreground">Emitir Documento Mercantil</h2>
              <p className="text-xs text-muted-foreground">
                Régimen Fiscal: <strong className="text-foreground">{adapter.countryName}</strong> • {adapter.taxIdLabel} Obligatorio
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1 font-semibold">{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Document Type Selector (5 Pills) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Tipo de Documento a Emitir</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { type: "INVOICE", label: "Factura", desc: "Venta fiscal" },
                { type: "CREDIT_NOTE", label: "Nota de Crédito", desc: "Anula / Repone" },
                { type: "DEBIT_NOTE", label: "Nota de Débito", desc: "Ajuste al alza" },
                { type: "DISPATCH_GUIDE", label: "Guía Despacho", desc: "Traslado en ruta" },
                { type: "DELIVERY_NOTE", label: "Orden Entrega", desc: "Recepción tienda" },
              ].map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setDocType(opt.type as FiscalDocumentType)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    docType === opt.type
                      ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                      : "border-border bg-card hover:bg-muted text-foreground"
                  }`}
                >
                  <p className="text-xs font-bold leading-tight">{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Affected Invoice Picker for Credit Note / Debit Note */}
          {isCreditOrDebit && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                <RotateCcw className="w-4 h-4" />
                <span>Factura Original a Modificar (Obligatoria por Ley)</span>
              </div>

              <div>
                <select
                  value={selectedAffectedInvoiceId}
                  onChange={(e) => handleSelectAffectedInvoice(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs font-medium text-foreground focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="">-- Selecciona la Factura Afectada --</option>
                  {existingInvoices
                    .filter((inv) => inv.document_type === "INVOICE")
                    .map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.document_number} ({inv.control_number || "S/C"}) - {inv.customer_name} (${inv.total_amount.toFixed(2)})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-foreground block mb-1">
                  Motivo de la {docType === "CREDIT_NOTE" ? "Nota de Crédito" : "Nota de Débito"}
                </label>
                <input
                  type="text"
                  placeholder="Ej: Devolución total por producto defectuoso / Error de precio"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              {docType === "CREDIT_NOTE" && (
                <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={returnItemsToInventory}
                    onChange={(e) => setReturnItemsToInventory(e.target.checked)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary"
                  />
                  <span>✓ Reponer automáticamente los ítems devueltos en el inventario físico</span>
                </label>
              )}
            </div>
          )}

          {/* Customer / Client Data */}
          <div className="p-3.5 rounded-xl border border-border bg-card space-y-3">
            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-primary" />
              <span>Datos del Cliente / Destinatario</span>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Razón Social / Nombre Completo *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Inversiones Los Andes C.A."
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  {adapter.taxIdLabel} (Doc. Fiscal) *
                </label>
                <input
                  type="text"
                  placeholder={adapter.countryCode === "CL" ? "Ej: 12.345.678-K" : "Ej: J-12345678-9"}
                  value={customerIdDoc}
                  onChange={(e) => setCustomerIdDoc(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-input bg-background text-xs font-mono uppercase text-foreground focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Teléfono / WhatsApp
                </label>
                <input
                  type="text"
                  placeholder="Ej: 04141234567"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Dirección de Entrega / Domicilio
                </label>
                <input
                  type="text"
                  placeholder="Ej: Av. Bolívar, Edif. Torre Centro, Piso 4"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Transport Info (for Guía de Despacho & Orden de Entrega) */}
          {isDispatchOrDelivery && (
            <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" />
                  <span>Datos del Transporte y Chofer (Guía de Tránsito)</span>
                </p>

                {availableDrivers.length > 0 && (
                  <select
                    onChange={(e) => handleSelectDriver(e.target.value)}
                    className="h-7 px-2 text-[11px] rounded-lg border border-border bg-background text-foreground"
                  >
                    <option value="">⚡ Cargar chofer de flota...</option>
                    {availableDrivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.vehicle_plate ? `(${d.vehicle_plate})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Nombre del Conductor
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Carlos Pérez"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    C.I. / RUT del Conductor
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: V-15678901"
                    value={driverIdDoc}
                    onChange={(e) => setDriverIdDoc(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Placa del Vehículo
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: AB123CD"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-input bg-background text-xs uppercase font-mono text-foreground focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Items Table Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">Productos / Ítems a Facturar</label>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar Ítem</span>
              </button>
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/60 border-b border-border text-muted-foreground font-semibold">
                    <th className="p-2.5 text-left">Descripción</th>
                    <th className="p-2.5 w-20 text-center">Cant.</th>
                    <th className="p-2.5 w-24 text-right">Precio ($)</th>
                    <th className="p-2.5 w-24 text-right">Total ($)</th>
                    <th className="p-2.5 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-muted/10">
                      <td className="p-2">
                        <input
                          type="text"
                          placeholder="Nombre del producto o servicio"
                          value={it.name}
                          onChange={(e) => {
                            const copy = [...items];
                            copy[idx].name = e.target.value;
                            setItems(copy);
                          }}
                          className="w-full h-8 px-2 rounded-lg border border-input bg-background text-xs text-foreground focus:ring-1 focus:ring-primary"
                          required
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={(e) => {
                            const copy = [...items];
                            copy[idx].quantity = Math.max(1, Number(e.target.value));
                            setItems(copy);
                          }}
                          className="w-full h-8 px-2 text-center rounded-lg border border-input bg-background text-xs font-mono text-foreground focus:ring-1 focus:ring-primary"
                          required
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.unit_price}
                          onChange={(e) => {
                            const copy = [...items];
                            copy[idx].unit_price = Math.max(0, Number(e.target.value));
                            setItems(copy);
                          }}
                          className="w-full h-8 px-2 text-right rounded-lg border border-input bg-background text-xs font-mono text-foreground focus:ring-1 focus:ring-primary"
                          required
                        />
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-foreground">
                        {formatCurrency(it.quantity * it.unit_price, "USD")}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          disabled={items.length <= 1}
                          className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Subtotal & Totals Preview */}
            <div className="p-3.5 rounded-xl bg-muted/30 border border-border text-xs space-y-1 text-right">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal Neto:</span>
                <span className="font-mono font-semibold text-foreground">{formatCurrency(subtotal, "USD")}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>IVA ({adapter.defaultIvaRate}%):</span>
                <span className="font-mono font-semibold text-foreground">{formatCurrency(iva, "USD")}</span>
              </div>
              <div className="flex justify-between text-sm font-black pt-1 border-t border-border">
                <span className="text-foreground">Total Estimado:</span>
                <span className="font-mono text-primary">{formatCurrency(total, "USD")}</span>
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:bg-primary/90 disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? "Emitiendo documento..." : "Emitir Documento Ahora"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
