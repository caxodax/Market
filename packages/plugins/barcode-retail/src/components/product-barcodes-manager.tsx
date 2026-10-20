import React, { useState } from "react";
import { ProductBarcode } from "@marketos/types";
import { Barcode, Plus, Trash2, CheckCircle2, PackageCheck, AlertCircle } from "lucide-react";
import { calculatePackPrice } from "../services/packaging-engine";
import { playScanSound } from "../utils/audio-feedback";

export interface ProductBarcodesManagerProps {
  productId: string;
  productName: string;
  basePriceUsd: number;
  initialBarcodes?: ProductBarcode[];
  onSaveBarcode: (barcodeData: Omit<ProductBarcode, "id" | "created_at">) => Promise<boolean>;
  onDeleteBarcode: (barcodeId: string) => Promise<boolean>;
  onClose?: () => void;
}

const COMMON_PACK_TYPES = [
  { label: "Unidad Individual", value: "UNIDAD", units: 1 },
  { label: "Six-Pack (6 Unidades)", value: "SIX_PACK", units: 6 },
  { label: "Docena (12 Unidades)", value: "DOCENA", units: 12 },
  { label: "Bulto de 20 (Harinas / Granos)", value: "BULTO_20", units: 20 },
  { label: "Bulto de 24 (Refrescos / Enlatados)", value: "BULTO_24", units: 24 },
  { label: "Caja Master (50 Unidades)", value: "CAJA_50", units: 50 },
];

export function ProductBarcodesManager({
  productId,
  productName,
  basePriceUsd,
  initialBarcodes = [],
  onSaveBarcode,
  onDeleteBarcode,
  onClose,
}: ProductBarcodesManagerProps) {
  const [barcodes, setBarcodes] = useState<ProductBarcode[]>(initialBarcodes);
  const [newBarcode, setNewBarcode] = useState("");
  const [packName, setPackName] = useState("UNIDAD");
  const [unitsPerPack, setUnitsPerPack] = useState(1);
  const [customPriceUsd, setCustomPriceUsd] = useState<string>("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handlePackTypeSelect = (units: number, name: string) => {
    setUnitsPerPack(units);
    setPackName(name);
  };

  const handleAddBarcode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBarcode.trim()) {
      setErrorMsg("Debes ingresar o escanear un código de barras.");
      playScanSound("error");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const priceVal = customPriceUsd.trim() ? parseFloat(customPriceUsd) : null;

    const payload = {
      tenant_id: "", // Injected by repository
      product_id: productId,
      barcode: newBarcode.trim(),
      pack_name: packName,
      units_per_pack: unitsPerPack,
      price_usd: priceVal,
      is_primary: isPrimary || barcodes.length === 0,
    };

    const success = await onSaveBarcode(payload);
    setLoading(false);

    if (success) {
      playScanSound("success");
      setBarcodes((prev) => [
        ...prev,
        {
          ...payload,
          id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(),
        },
      ]);
      setNewBarcode("");
      setCustomPriceUsd("");
      setSuccessMsg(`Código ${payload.barcode} (${payload.pack_name}) guardado.`);
    } else {
      playScanSound("error");
      setErrorMsg("Error al guardar el código de barras. Puede que ya esté registrado.");
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`¿Eliminar el código ${code}?`)) return;
    setLoading(true);
    const success = await onDeleteBarcode(id);
    setLoading(false);
    if (success) {
      playScanSound("warning");
      setBarcodes((prev) => prev.filter((b) => b.id !== id));
      setSuccessMsg("Código eliminado.");
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-xl border border-zinc-200 dark:border-zinc-800 max-w-2xl w-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Barcode className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Códigos de Barra & Empaques
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {productName} • Precio Base: ${basePriceUsd.toFixed(2)} USD
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-sm font-semibold p-1"
          >
            ✕
          </button>
        )}
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Existing Barcodes List */}
      <div className="mt-5 space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
          Códigos Registrados ({barcodes.length})
        </label>
        {barcodes.length === 0 ? (
          <div className="text-center py-6 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-400">
            No hay códigos de barra registrados para este producto.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
            {barcodes.map((item) => {
              const pricing = calculatePackPrice(basePriceUsd, item);
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60"
                >
                  <div className="flex items-center gap-3">
                    <div className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <Barcode className="w-4 h-4 text-zinc-400" />
                      {item.barcode}
                    </div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                      {item.pack_name} (x{item.units_per_pack})
                    </span>
                    {item.is_primary && (
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                        Principal
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        ${pricing.totalPrice.toFixed(2)} USD
                      </div>
                      {pricing.savingsPercentage > 0 && (
                        <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          Ahorro {pricing.savingsPercentage}%
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(item.id, item.barcode)}
                      disabled={loading}
                      className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                      title="Eliminar código"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add New Barcode Form */}
      <form onSubmit={handleAddBarcode} className="mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
        <div className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-blue-500" />
          Añadir Nuevo Código o Empaque
        </div>

        {/* Quick Packaging Selectors */}
        <div className="flex flex-wrap gap-1.5">
          {COMMON_PACK_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => handlePackTypeSelect(type.units, type.value)}
              className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                unitsPerPack === type.units
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Código de Barras (Escanea o Teclea)
            </label>
            <div className="relative">
              <input
                type="text"
                value={newBarcode}
                onChange={(e) => setNewBarcode(e.target.value)}
                placeholder="ej. 7591234567890"
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                autoFocus
              />
              <Barcode className="w-4 h-4 absolute right-3 top-3 text-zinc-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Precio Especial de Empaque ($ USD)
            </label>
            <input
              type="number"
              step="0.01"
              value={customPriceUsd}
              onChange={(e) => setCustomPriceUsd(e.target.value)}
              placeholder={`Automático: $${(basePriceUsd * unitsPerPack).toFixed(2)}`}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !newBarcode.trim()}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
        >
          <PackageCheck className="w-4 h-4" />
          {loading ? "Guardando..." : "Registrar Código de Empaque"}
        </button>
      </form>
    </div>
  );
}
