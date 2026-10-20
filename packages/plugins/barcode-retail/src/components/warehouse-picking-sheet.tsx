import React, { useState } from "react";
import { PickingItem } from "@marketos/types";
import { optimizePickingRoute, formatLocationCode } from "../services/picking-route-optimizer";
import { MapPin, CheckSquare, Square, Printer, PackageCheck } from "lucide-react";
import { playScanSound } from "../utils/audio-feedback";

export interface WarehousePickingSheetProps {
  orderNumber: string;
  customerName?: string;
  items: PickingItem[];
  onCompletePicking?: () => void;
  onClose?: () => void;
}

export function WarehousePickingSheet({
  orderNumber,
  customerName,
  items,
  onCompletePicking,
  onClose,
}: WarehousePickingSheetProps) {
  const optimized = optimizePickingRoute(items);
  const [pickedState, setPickedState] = useState<Record<string, boolean>>({});

  const togglePicked = (itemId: string) => {
    const nextVal = !pickedState[itemId];
    setPickedState((prev) => ({ ...prev, [itemId]: nextVal }));
    playScanSound(nextVal ? "success" : "warning");
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const pickedCount = Object.values(pickedState).filter(Boolean).length;
  const progressPct =
    optimized.totalItems > 0 ? Math.round((pickedCount / optimized.totalItems) * 100) : 0;
  const allPicked = pickedCount === optimized.totalItems && optimized.totalItems > 0;

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-2xl p-6 shadow-xl border border-zinc-200 dark:border-zinc-800 max-w-3xl w-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 rounded-full">
              Ruta de Picking Inteligente
            </span>
            <span className="text-xs text-zinc-400">•</span>
            <span className="text-xs text-zinc-500 font-bold">{optimized.distinctAislesCount} pasillos</span>
          </div>
          <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100 mt-1">
            Pedido #{orderNumber} {customerName ? `• ${customerName}` : ""}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5 text-xs font-bold"
            title="Imprimir Hoja de Picking"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-sm font-semibold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs font-bold mb-1.5">
            <span className="text-zinc-600 dark:text-zinc-400">Progreso de Surtido:</span>
            <span className={allPicked ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600"}>
              {pickedCount} de {optimized.totalItems} ítems ({progressPct}%)
            </span>
          </div>
          <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                allPicked ? "bg-emerald-500" : "bg-blue-600"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Optimized Items List */}
      <div className="mt-5 space-y-2 max-h-96 overflow-y-auto pr-1">
        {optimized.items.map((item, idx) => {
          const isDone = !!pickedState[item.orderItemId];
          const locStr = formatLocationCode(item.location);

          return (
            <div
              key={item.orderItemId || idx}
              onClick={() => togglePicked(item.orderItemId)}
              className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none transition-all ${
                isDone
                  ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 opacity-60 line-through"
                  : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-blue-400"
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="text-zinc-400 hover:text-blue-600 transition-colors"
                >
                  {isDone ? (
                    <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-blue-500" />
                      {locStr}
                    </span>
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {item.productName}
                    </span>
                  </div>

                  <div className="text-xs text-zinc-500 font-mono mt-0.5 flex items-center gap-2">
                    {item.barcode && <span>EAN: {item.barcode}</span>}
                    {item.packName && item.packName !== "UNIDAD" && (
                      <span className="text-blue-600 dark:text-blue-400 font-bold uppercase">
                        • {item.packName} (x{item.unitsPerPack})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-base font-black text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-lg">
                  {item.quantity} {item.packName && item.packName !== "UNIDAD" ? "packs" : "uds"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <div className="text-xs text-zinc-500">
          Total Unidades a Surtir: <strong className="text-zinc-900 dark:text-zinc-100">{optimized.totalUnits}</strong>
        </div>

        {onCompletePicking && (
          <button
            onClick={onCompletePicking}
            disabled={!allPicked}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all"
          >
            <PackageCheck className="w-4 h-4" />
            Marcar Pedido como Surtido y Listo
          </button>
        )}
      </div>
    </div>
  );
}
