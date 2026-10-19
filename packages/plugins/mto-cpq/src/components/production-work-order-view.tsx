"use client";

import React, { useState } from "react";
import { CpqWorkOrder, CpqQuoteItem } from "@marketos/types";
import {
  Printer,
  ClipboardList,
  CheckCircle2,
  Clock,
  PackageCheck,
  FileText,
  AlertTriangle,
  Download,
  Scissors,
} from "lucide-react";

export interface ProductionWorkOrderViewProps {
  workOrder: CpqWorkOrder;
  quoteItem?: CpqQuoteItem;
  customerName?: string;
  orderNumber?: string;
  onStatusChange?: (newStatus: CpqWorkOrder["status"]) => void;
  className?: string;
}

export function ProductionWorkOrderView({
  workOrder,
  quoteItem,
  customerName,
  orderNumber,
  onStatusChange,
  className = "",
}: ProductionWorkOrderViewProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const sheet = workOrder.production_sheet || {};
  const dimensions = sheet.dimensions || quoteItem?.dimensions;
  const attributes = sheet.selected_attributes || quoteItem?.selected_attributes || {};
  const files = sheet.files_to_print || [];
  const consumables = sheet.materials_to_consume || [];
  const notes = sheet.technical_specs || (sheet.operator_notes ? [sheet.operator_notes] : []);

  const toggleStep = (stepKey: string) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepKey)) {
        next.delete(stepKey);
      } else {
        next.add(stepKey);
      }
      return next;
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const statusColors: Record<CpqWorkOrder["status"], string> = {
    QUEUED: "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-300",
    IN_PROCESS: "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border-blue-300",
    READY: "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300",
    DELIVERED: "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-300",
  };

  const statusLabels: Record<CpqWorkOrder["status"], string> = {
    QUEUED: "En Cola / Espera",
    IN_PROCESS: "En Fabricación / Taller",
    READY: "Listo para Entrega",
    DELIVERED: "Entregado",
  };

  return (
    <div
      className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-6 print:border-none print:shadow-none print:p-0 ${className}`}
    >
      {/* Print Action Bar (Hidden when printing) */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 print:hidden">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
            Ficha de Fabricación y Control de Taller
          </span>
        </div>

        <div className="flex items-center gap-3">
          {onStatusChange && (
            <select
              value={workOrder.status}
              onChange={(e) => onStatusChange(e.target.value as CpqWorkOrder["status"])}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium"
            >
              <option value="QUEUED">En Cola</option>
              <option value="IN_PROCESS">En Proceso</option>
              <option value="READY">Listo</option>
              <option value="DELIVERED">Entregado</option>
            </select>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-xs font-medium transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir Ficha</span>
          </button>
        </div>
      </div>

      {/* Main Order Header for Workshop */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              ORDEN DE TALLER #{workOrder.id.slice(0, 8).toUpperCase()}
            </h2>
            <span
              className={`text-xs px-2 py-0.5 rounded-md font-semibold border ${statusColors[workOrder.status]}`}
            >
              {statusLabels[workOrder.status]}
            </span>
          </div>

          <div className="text-xs text-zinc-600 dark:text-zinc-400 space-x-3">
            {orderNumber && <span>Pedido Core: <b>{orderNumber}</b></span>}
            {customerName && <span>Cliente: <b>{customerName}</b></span>}
            <span>Fecha Emisión: <b>{workOrder.created_at ? new Date(workOrder.created_at).toLocaleDateString() : "-"}</b></span>
          </div>
        </div>

        {quoteItem?.quantity && (
          <div className="text-right sm:border-l sm:pl-4 border-zinc-200 dark:border-zinc-700">
            <span className="text-xs text-zinc-500 uppercase tracking-wider block">
              Cantidad Requerida
            </span>
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {quoteItem.quantity} <span className="text-sm font-normal text-zinc-500">unid.</span>
            </span>
          </div>
        )}
      </div>

      {/* Workshop Dimensions Box */}
      {dimensions && (
        <div className="p-4 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
            <Scissors className="w-4 h-4 text-indigo-500" />
            <span>Medidas y Dimensiones Técnicas de Corte</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
            {dimensions.width !== undefined && (
              <div className="bg-zinc-100 dark:bg-zinc-800/60 p-2.5 rounded-lg text-center">
                <span className="text-[11px] text-zinc-500 block">Ancho</span>
                <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {dimensions.width} {dimensions.unit || "cm"}
                </span>
              </div>
            )}
            {dimensions.height !== undefined && (
              <div className="bg-zinc-100 dark:bg-zinc-800/60 p-2.5 rounded-lg text-center">
                <span className="text-[11px] text-zinc-500 block">Alto</span>
                <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {dimensions.height} {dimensions.unit || "cm"}
                </span>
              </div>
            )}
            {dimensions.length !== undefined && (
              <div className="bg-zinc-100 dark:bg-zinc-800/60 p-2.5 rounded-lg text-center">
                <span className="text-[11px] text-zinc-500 block">Longitud</span>
                <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {dimensions.length} {dimensions.unit || "cm"}
                </span>
              </div>
            )}
            {dimensions.depth !== undefined && (
              <div className="bg-zinc-100 dark:bg-zinc-800/60 p-2.5 rounded-lg text-center">
                <span className="text-[11px] text-zinc-500 block">Profundidad</span>
                <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {dimensions.depth} {dimensions.unit || "cm"}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Technical Attributes / Specifications */}
      {Object.keys(attributes).length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Especificaciones y Acabados de Fabricación
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(attributes).map(([attrKey, attrVal]) => (
              <div
                key={attrKey}
                className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 text-xs"
              >
                <span className="text-zinc-500 uppercase tracking-wider font-medium">
                  {attrKey}:
                </span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {String(attrVal)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Material Picking / Consumables */}
      {consumables.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Insumos & Materiales a Retirar de Almacén
          </span>
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800">
            {consumables.map((item, idx) => {
              const key = `consumable-${idx}`;
              const isChecked = completedSteps.has(key);
              return (
                <div
                  key={idx}
                  onClick={() => toggleStep(key)}
                  className="flex items-center justify-between p-3 text-xs cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-0"
                    />
                    <span className={isChecked ? "line-through text-zinc-400" : "text-zinc-800 dark:text-zinc-200 font-medium"}>
                      {item.name}
                    </span>
                  </div>
                  <span className="text-zinc-600 dark:text-zinc-400 font-semibold bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                    {item.quantity} {item.unit}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Production Attachments / Files */}
      {files.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Archivos & Diseños Adjuntos
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {files.map((file, idx) => (
              <a
                key={idx}
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-indigo-400 bg-white dark:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="truncate font-medium">{file.name}</span>
                </div>
                <Download className="w-3.5 h-3.5 text-zinc-400 shrink-0 ml-2" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Workshop QC Sign-off */}
      <div className="pt-2 space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Checklist de Calidad & Operación
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {["Material retirado y verificado", "Impresión / Corte completado", "Control de medidas aprobado", "Empaque y rotulación lista"].map(
            (label, idx) => {
              const stepKey = `step-${idx}`;
              const checked = completedSteps.has(stepKey);
              return (
                <div
                  key={stepKey}
                  onClick={() => toggleStep(stepKey)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                    checked
                      ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300"
                      : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <CheckCircle2
                    className={`w-4 h-4 ${checked ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"}`}
                  />
                  <span>{label}</span>
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* Operator Signature & Sign-off on Print */}
      <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 hidden print:grid grid-cols-2 gap-8 text-center text-xs text-zinc-500">
        <div className="border-t border-zinc-400 pt-2">
          <span>Firma Operador de Taller</span>
        </div>
        <div className="border-t border-zinc-400 pt-2">
          <span>Control de Calidad (QC)</span>
        </div>
      </div>
    </div>
  );
}
