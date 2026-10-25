"use client";

import React, { useState, useRef } from "react";
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileText,
  Boxes,
} from "lucide-react";
import type { Category } from "@marketos/types";
import {
  parseProductsExcel,
  downloadProductImportTemplate,
  type ParsedProductRow,
} from "../lib/productExcel";
import { bulkImportProductsAction } from "../app/admin/actions";

interface ProductImportModalProps {
  tenantId: string;
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (importedCount: number) => void;
  onQuotaExceeded: () => void;
}

export function ProductImportModal({
  tenantId,
  categories,
  isOpen,
  onClose,
  onSuccess,
  onQuotaExceeded,
}: ProductImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [validRows, setValidRows] = useState<ParsedProductRow[]>([]);
  const [parseErrors, setParseErrors] = useState<{ row: number; error: string }[]>([]);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    await processFile(selected);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      await processFile(droppedFile);
    }
  };

  const processFile = async (f: File) => {
    setFile(f);
    setParsing(true);
    setImportResult(null);
    setValidRows([]);
    setParseErrors([]);

    try {
      const res = await parseProductsExcel(f);
      setValidRows(res.validRows);
      setParseErrors(res.errors);
    } catch (err) {
      setParseErrors([
        {
          row: 0,
          error:
            err instanceof Error
              ? err.message
              : "No se pudo leer el archivo Excel. Verifica que tenga un formato .xlsx válido.",
        },
      ]);
    } finally {
      setParsing(false);
    }
  };

  const handleExecuteImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setImportResult(null);

    try {
      const res = await bulkImportProductsAction(tenantId, validRows);
      if (res.success && res.importedCount !== undefined) {
        setImportResult({
          success: true,
          message: `¡Éxito! Se importaron ${res.importedCount} de ${res.totalRequested} productos correctamente.`,
        });
        setTimeout(() => {
          onSuccess(res.importedCount || 0);
          handleClose();
        }, 1200);
      } else if (res.quotaExceeded) {
        setImportResult({
          success: false,
          message: res.error || "Cupo del plan excedido.",
        });
        onQuotaExceeded();
      } else {
        setImportResult({
          success: false,
          message: res.error || "Ocurrió un error al procesar la importación.",
        });
      }
    } catch (err) {
      setImportResult({
        success: false,
        message: err instanceof Error ? err.message : "Error inesperado al importar.",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setValidRows([]);
    setParseErrors([]);
    setImportResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground">Importación Masiva de Productos</h2>
              <p className="text-[11px] text-muted-foreground">Carga tu catálogo completo vía archivo Excel (.xlsx)</p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Step 1: Download Template Helper */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-muted/30 border border-border">
            <div className="space-y-0.5">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-primary" />
                ¿Aún no tienes el formato adecuado?
              </p>
              <p className="text-muted-foreground text-[11px]">
                Descarga la plantilla con las columnas oficiales y categorías ya configuradas de tu tienda.
              </p>
            </div>

            <button
              type="button"
              onClick={() => downloadProductImportTemplate(categories)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 font-bold transition-all shrink-0 cursor-pointer text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar Plantilla (.xlsx)</span>
            </button>
          </div>

          {/* Step 2: Upload Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
              file
                ? "border-emerald-500/50 bg-emerald-500/5"
                : "border-border hover:border-primary/50 hover:bg-muted/20"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />

            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Upload className="w-6 h-6" />
            </div>

            {file ? (
              <div className="space-y-1">
                <p className="font-bold text-foreground text-sm">{file.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB • Haz clic para cambiar de archivo
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-bold text-foreground">Haz clic para seleccionar o arrastra tu archivo aquí</p>
                <p className="text-[11px] text-muted-foreground">Archivos soportados: Microsoft Excel (.xlsx)</p>
              </div>
            )}
          </div>

          {/* Parsing State */}
          {parsing && (
            <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Analizando y validando estructura del archivo...</span>
            </div>
          )}

          {/* Validation Feedback */}
          {!parsing && file && (
            <div className="space-y-3">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider block">Productos Listos</span>
                  <strong className="text-lg font-black">{validRows.length}</strong>
                </div>

                <div
                  className={`p-3 rounded-xl border ${
                    parseErrors.length > 0
                      ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                      : "bg-muted/40 border-border text-muted-foreground"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider block">Filas con Error</span>
                  <strong className="text-lg font-black">{parseErrors.length}</strong>
                </div>
              </div>

              {/* Error messages if any */}
              {parseErrors.length > 0 && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 space-y-1.5 max-h-36 overflow-y-auto">
                  <div className="flex items-center gap-1.5 font-bold text-[11px]">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Se omitirán las siguientes filas con errores:</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5 text-[10px]">
                    {parseErrors.slice(0, 10).map((err, i) => (
                      <li key={i}>
                        {err.row > 0 ? `Fila ${err.row}: ` : ""}
                        {err.error}
                      </li>
                    ))}
                    {parseErrors.length > 10 && <li>... y {parseErrors.length - 10} errores adicionales.</li>}
                  </ul>
                </div>
              )}

              {/* Preview of Valid Products */}
              {validRows.length > 0 && (
                <div className="border border-border rounded-xl overflow-hidden bg-background">
                  <div className="px-3 py-2 bg-muted/40 border-b border-border font-bold text-[11px] text-muted-foreground flex items-center justify-between">
                    <span>Vista previa de productos válidos</span>
                    <span>Mostrando primeros {Math.min(5, validRows.length)}</span>
                  </div>
                  <div className="divide-y divide-border text-[11px]">
                    {validRows.slice(0, 5).map((row, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-foreground truncate">{row.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {row.categoryName} {row.sku ? `• SKU: ${row.sku}` : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono font-bold text-primary">${row.priceUsd.toFixed(2)}</p>
                          <p className="text-[10px] text-muted-foreground">{row.stock} unid.</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Import Result Notification */}
          {importResult && (
            <div
              className={`p-4 rounded-xl border flex items-center gap-2.5 ${
                importResult.success
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
              }`}
            >
              {importResult.success ? (
                <CheckCircle2 className="w-5 h-5 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0" />
              )}
              <span className="font-semibold text-xs">{importResult.message}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
          <button
            type="button"
            onClick={handleClose}
            disabled={importing}
            className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted font-bold text-xs transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={importing || validRows.length === 0}
            className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              validRows.length === 0 || importing
                ? "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md active:scale-95"
            }`}
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Importando {validRows.length} productos...</span>
              </>
            ) : (
              <>
                <Boxes className="w-4 h-4" />
                <span>Confirmar e Importar {validRows.length > 0 ? `(${validRows.length})` : ""}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
