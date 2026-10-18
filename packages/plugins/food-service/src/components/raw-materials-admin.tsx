"use client";

import React, { useState } from "react";
import { RawMaterial, RawMaterialUnit, Store } from "@marketos/types";
import { formatCurrency } from "@marketos/utils";
import {
  Beef,
  AlertTriangle,
  Plus,
  Search,
  Package,
  TrendingDown,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  Layers,
} from "lucide-react";

interface RawMaterialsAdminProps {
  tenantId: string;
  stores: Store[];
  rawMaterials: RawMaterial[];
  onSaveRawMaterial: (material: Partial<RawMaterial> & { tenant_id: string; store_id: string; name: string }) => Promise<void>;
  onDeleteRawMaterial: (id: string) => Promise<void>;
}

export function RawMaterialsAdmin({
  tenantId,
  stores,
  rawMaterials,
  onSaveRawMaterial,
  onDeleteRawMaterial,
}: RawMaterialsAdminProps) {
  const [selectedStoreId, setSelectedStoreId] = useState<string>(stores[0]?.id || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RawMaterial | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState<RawMaterialUnit>("UNIT");
  const [currentStock, setCurrentStock] = useState<number>(100);
  const [minAlertStock, setMinAlertStock] = useState<number>(20);
  const [costPerUnitUsd, setCostPerUnitUsd] = useState<number>(0.25);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openCreateModal = () => {
    setEditingItem(null);
    setName("");
    setSku("");
    setUnit("UNIT");
    setCurrentStock(100);
    setMinAlertStock(20);
    setCostPerUnitUsd(0.25);
    setIsModalOpen(true);
  };

  const openEditModal = (item: RawMaterial) => {
    setEditingItem(item);
    setName(item.name);
    setSku(item.sku || "");
    setUnit(item.unit);
    setCurrentStock(item.current_stock);
    setMinAlertStock(item.min_alert_stock);
    setCostPerUnitUsd(item.cost_per_unit_usd);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSaveRawMaterial({
        id: editingItem?.id,
        tenant_id: tenantId,
        store_id: selectedStoreId || stores[0]?.id || "store-1",
        name: name.trim(),
        sku: sku.trim() || undefined,
        unit,
        current_stock: Number(currentStock),
        min_alert_stock: Number(minAlertStock),
        cost_per_unit_usd: Number(costPerUnitUsd),
        is_active: true,
      });
      setIsModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick increment/decrement stock button (+20, -10)
  const handleQuickAdjust = async (item: RawMaterial, delta: number) => {
    const nextStock = Math.max(0, Number((item.current_stock + delta).toFixed(2)));
    await onSaveRawMaterial({
      ...item,
      current_stock: nextStock,
    });
  };

  // Filtered ingredients
  const filteredMaterials = rawMaterials.filter((m) => {
    if (selectedStoreId && m.store_id !== selectedStoreId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return m.name.toLowerCase().includes(q) || (m.sku && m.sku.toLowerCase().includes(q));
    }
    return true;
  });

  // Analytics Metrics
  const lowStockCount = rawMaterials.filter(
    (m) => (!selectedStoreId || m.store_id === selectedStoreId) && m.current_stock <= m.min_alert_stock
  ).length;

  const totalInventoryValueUsd = rawMaterials
    .filter((m) => !selectedStoreId || m.store_id === selectedStoreId)
    .reduce((sum, m) => sum + m.current_stock * m.cost_per_unit_usd, 0);

  return (
    <div className="space-y-6">
      {/* Header and Branch Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
            <Beef className="w-5 h-5 text-amber-500" />
            <span>Inventario de Materia Prima e Insumos</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Control de insumos de cocina (panes, salchichas, salsas) para reabastecimiento de sedes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {stores.length > 1 && (
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="h-9 px-3 rounded-xl border border-border bg-card text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Todas las Sedes</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={openCreateModal}
            className="h-9 px-3.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-primary/90 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Insumo</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Total Insumos
            </p>
            <p className="text-lg font-black text-foreground">{rawMaterials.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              lowStockCount > 0
                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Alertas de Stock Bajo
            </p>
            <p
              className={`text-lg font-black ${
                lowStockCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"
              }`}
            >
              {lowStockCount} {lowStockCount === 1 ? "insumo crítico" : "insumos críticos"}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Valor en Insumos
            </p>
            <p className="text-lg font-black text-foreground">
              {formatCurrency(totalInventoryValueUsd, "USD")}
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar insumo (ej. Pan, Salchicha, Queso, Papitas)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-10 pl-9 pr-4 rounded-xl border border-input bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Raw Materials Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-4">Insumo</th>
                <th className="py-3 px-4">Unidad</th>
                <th className="py-3 px-4">Stock Actual</th>
                <th className="py-3 px-4">Alerta Mínima</th>
                <th className="py-3 px-4">Costo Unitario</th>
                <th className="py-3 px-4 text-center">Ajuste Rápido</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground font-semibold">
                    No se encontraron insumos de cocina registrados.
                  </td>
                </tr>
              ) : (
                filteredMaterials.map((item) => {
                  const isLow = item.current_stock <= item.min_alert_stock;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-muted/40 transition-colors ${
                        isLow ? "bg-rose-500/5" : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-foreground">{item.name}</div>
                        {item.sku && (
                          <div className="text-[10px] font-mono text-muted-foreground">
                            {item.sku}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">{item.unit}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 font-black px-2 py-0.5 rounded-lg text-xs ${
                            isLow
                              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          {isLow ? (
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                          )}
                          <span>
                            {item.current_stock} {item.unit}
                          </span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-muted-foreground">
                        {item.min_alert_stock} {item.unit}
                      </td>
                      <td className="py-3 px-4 font-semibold text-foreground">
                        {formatCurrency(item.cost_per_unit_usd, "USD")}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleQuickAdjust(item, item.unit === "UNIT" ? 10 : 1)}
                            className="px-2 py-1 rounded-lg bg-muted hover:bg-muted/80 text-[10px] font-bold text-foreground cursor-pointer"
                            title="Añadir stock"
                          >
                            +{item.unit === "UNIT" ? 10 : 1}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickAdjust(item, item.unit === "UNIT" ? -10 : -1)}
                            className="px-2 py-1 rounded-lg bg-muted hover:bg-muted/80 text-[10px] font-bold text-foreground cursor-pointer"
                            title="Restar stock"
                          >
                            -{item.unit === "UNIT" ? 10 : 1}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
                            title="Editar insumo"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteRawMaterial(item.id)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer transition-colors"
                            title="Archivar insumo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative w-full max-w-md bg-card text-foreground rounded-2xl border border-border shadow-2xl p-5 z-10 space-y-4">
            <h3 className="text-sm font-black text-foreground">
              {editingItem ? "Editar Insumo de Cocina" : "Nuevo Insumo de Cocina"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-muted-foreground block mb-1">
                  Nombre del Insumo:
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Pan de Perro Caliente Bimbo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-input bg-background font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Código / SKU:</label>
                  <input
                    type="text"
                    placeholder="ej. PAN-001"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-input bg-background font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Unidad:</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as RawMaterialUnit)}
                    className="w-full h-9 px-3 rounded-xl border border-input bg-background font-bold"
                  >
                    <option value="UNIT">Unidades (Panes, Salchichas)</option>
                    <option value="KG">Kilogramos (Queso, Papas)</option>
                    <option value="G">Gramos</option>
                    <option value="L">Litros (Salsas)</option>
                    <option value="PORTION">Porciones</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Stock Actual:</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={currentStock}
                    onChange={(e) => setCurrentStock(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 px-3 rounded-xl border border-input bg-background font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Alerta Mínima:</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={minAlertStock}
                    onChange={(e) => setMinAlertStock(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 px-3 rounded-xl border border-input bg-background font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Costo ($):</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={costPerUnitUsd}
                    onChange={(e) => setCostPerUnitUsd(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 px-3 rounded-xl border border-input bg-background font-bold"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-black hover:bg-primary/90 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? "Guardando..." : "Guardar Insumo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
