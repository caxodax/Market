import React, { useState } from "react";
import { ScanBarcode, Volume2, VolumeX, CheckCircle, Package, Search, ShoppingBag } from "lucide-react";
import { useBarcodeScanner } from "../hooks/use-barcode-scanner";
import { parseScaleBarcode } from "../services/scale-barcode-parser";
import { playScanSound } from "../utils/audio-feedback";

export interface ScannedItemRow {
  scanId: string;
  barcode: string;
  productName: string;
  packName: string;
  quantity: number;
  unitPriceUsd: number;
  totalPriceUsd: number;
  isScaleProduct?: boolean;
  scaleWeightKg?: number;
  timestamp: string;
}

export interface RetailFastScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductResolved: (barcode: string, multiplier: number) => Promise<ScannedItemRow | null>;
  title?: string;
  mode?: "CASHIER" | "STOCK_AUDIT";
}

export function RetailFastScannerModal({
  isOpen,
  onClose,
  onProductResolved,
  title = "Terminal de Escaneo Rápido (Láser HID)",
  mode = "CASHIER",
}: RetailFastScannerModalProps) {
  const [scannedItems, setScannedItems] = useState<ScannedItemRow[]>([]);
  const [manualCode, setManualCode] = useState("");
  const [multiplier, setMultiplier] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);

  const processBarcode = async (code: string, mult: number = 1) => {
    if (!code || isProcessing) return;
    setIsProcessing(true);
    setLastScannedBarcode(code);

    try {
      // 1. Check if it's a GS1 scale barcode (e.g. 200145200450)
      const scaleData = parseScaleBarcode(code);

      const resolved = await onProductResolved(code, mult);

      if (resolved) {
        if (soundEnabled) playScanSound("success");
        setScannedItems((prev) => [
          {
            ...resolved,
            scanId: Math.random().toString(),
            isScaleProduct: scaleData.isScaleBarcode,
            scaleWeightKg: scaleData.weightKg,
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prev,
        ]);
      } else {
        if (soundEnabled) playScanSound("error");
      }
    } finally {
      setIsProcessing(false);
      setMultiplier(1);
    }
  };

  // Listen to physical USB/Bluetooth laser scanner bursts
  useBarcodeScanner({
    enabled: isOpen,
    playFeedbackAudio: false, // We control audio based on soundEnabled state
    onScan: (barcode, mult) => {
      processBarcode(barcode, mult || multiplier);
    },
  });

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      processBarcode(manualCode.trim(), multiplier);
      setManualCode("");
    }
  };

  if (!isOpen) return null;

  const totalSum = scannedItems.reduce((sum, item) => sum + item.totalPriceUsd, 0);
  const totalUnits = scannedItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-950 rounded-2xl w-full max-w-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <ScanBarcode className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Listo para lectura láser (HID) • Apunta y presiona el gatillo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg border border-zinc-200 dark:border-zinc-800"
              title={soundEnabled ? "Silenciar Bip" : "Activar Bip"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-500" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-sm font-semibold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Live Multiplier & Manual Input Bar */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <span className="text-xs font-bold text-zinc-500 uppercase">Multiplicador:</span>
            {[1, 2, 6, 12, 24].map((n) => (
              <button
                key={n}
                onClick={() => setMultiplier(n)}
                className={`text-xs px-2 py-0.5 rounded font-bold transition-colors ${
                  multiplier === n
                    ? "bg-blue-600 text-white"
                    : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                }`}
              >
                {n}x
              </button>
            ))}
          </div>

          <form onSubmit={handleManualSubmit} className="flex-1 min-w-[240px] flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="O escribe el código y presiona Enter..."
                className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-3 py-1.5 bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900 text-xs font-bold rounded-xl disabled:opacity-40"
            >
              Buscar
            </button>
          </form>
        </div>

        {/* Scanned Items Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {scannedItems.length === 0 ? (
            <div className="text-center py-16 text-zinc-400 flex flex-col items-center justify-center gap-3">
              <ScanBarcode className="w-12 h-12 opacity-30" />
              <p className="text-sm font-medium">No hay productos escaneados en esta sesión.</p>
              <p className="text-xs text-zinc-500 max-w-sm">
                Escanea cualquier producto con tu pistola láser o escribe su código arriba para agregarlo al instante.
              </p>
            </div>
          ) : (
            scannedItems.map((item, idx) => (
              <div
                key={item.scanId}
                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                  idx === 0
                    ? "bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {item.productName}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                      <span>{item.barcode}</span>
                      <span>•</span>
                      <span className="text-blue-600 dark:text-blue-400 font-bold uppercase">
                        {item.packName}
                      </span>
                      {item.isScaleProduct && item.scaleWeightKg && (
                        <span className="text-amber-600 dark:text-amber-400 font-bold">
                          • {item.scaleWeightKg} kg
                        </span>
                      )}
                      <span>•</span>
                      <span className="text-zinc-400">{item.timestamp}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    ${item.totalPriceUsd.toFixed(2)} USD
                  </div>
                  <div className="text-xs text-zinc-500">
                    {item.quantity} x ${item.unitPriceUsd.toFixed(2)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer with Totals & Actions */}
        <div className="p-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 flex items-center justify-between rounded-b-2xl">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-xs text-zinc-500">Total Ítems:</div>
              <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{totalUnits}</div>
            </div>
            {mode === "CASHIER" && (
              <div>
                <div className="text-xs text-zinc-500">Importe Total:</div>
                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  ${totalSum.toFixed(2)} USD
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setScannedItems([])}
              disabled={scannedItems.length === 0}
              className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-red-500 disabled:opacity-40 transition-colors"
            >
              Limpiar Todo
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/20 flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Finalizar Sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
