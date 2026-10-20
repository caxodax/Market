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
  Layers,
  ArrowDownToLine,
  Edit2,
  Trash2,
  CheckCircle2,
  TrendingDown,
  X,
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
  const [statusFilter, setStatusFilter] = useState<"ALL" | "CRITICAL" | "OUT_OF_STOCK">("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RawMaterial | null>(null);

  // Supplier Intake / Restock Modal
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [restockMaterialId, setRestockMaterialId] = useState<string>("");
  const [restockQuantity, setRestockQuantity] = useState<number>(10);
  const [restockNewUnitCost, setRestockNewUnitCost] = useState<number>(0);

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

  const openRestockModal = (item?: RawMaterial) => {
    const target = item || rawMaterials[0];
    if (target) {
      setRestockMaterialId(target.id);
      setRestockNewUnitCost(target.cost_per_unit_usd);
      setRestockQuantity(10);
      setIsRestockModalOpen(true);
    }
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

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const item = rawMaterials.find((r) => r.id === restockMaterialId);
    if (!item) return;

    setIsSubmitting(true);
    try {
      const addedQty = Math.max(0.001, restockQuantity);
      const newStock = Number((item.current_stock + addedQty).toFixed(3));
      const newCost = restockNewUnitCost > 0 ? restockNewUnitCost : item.cost_per_unit_usd;

      await onSaveRawMaterial({
        ...item,
        current_stock: newStock,
        cost_per_unit_usd: newCost,
        updated_at: new Date().toISOString(),
      });
      setIsRestockModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick increment/decrement stock button (+20, -10)
  const handleQuickAdjust = async (item: RawMaterial, delta: number) => {
    const nextStock = Math.max(0, Number((item.current_stock + delta).toFixed(3)));
    await onSaveRawMaterial({
      ...item,
      current_stock: nextStock,
      updated_at: new Date().toISOString(),
    });
  };

  // Filtered ingredients
  const filteredMaterials = rawMaterials.filter((m) => {
    if (selectedStoreId && m.store_id !== selectedStoreId) return false;

    if (statusFilter === "CRITICAL" && m.current_stock > m.min_alert_stock) {
      return false;
    }
    if (statusFilter === "OUT_OF_STOCK" && m.current_stock > 0) {
      return false;
    }

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

  const outOfStockCount = rawMaterials.filter(
    (m) => (!selectedStoreId || m.store_id === selectedStoreId) && m.current_stock <= 0
  ).length;

  const totalInventoryValueUsd = rawMaterials
    .filter((m) => !selectedStoreId || m.store_id === selectedStoreId)
    .reduce((sum, m) => sum + m.current_stock * m.cost_per_unit_usd, 0);

  return (
    <div className="space-y-6">
      {/* Header and Branch Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Beef className="w-5 h-5 text-amber-500" />
            <span>Inventario de Materia Prima e Insumos</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Control de insumos de cocina (carnes, panes, salchichas, salsas, quesos) con alerta de quiebre.
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
            onClick={() => openRestockModal()}
            className="h-9 px-3.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <ArrowDownToLine className="w-4 h-4 text-emerald-500" />
            <span>Entrada Mercancía</span>
          </button>

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

      {/* Search Bar & Quick Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar insumo (ej. Pan, Salchicha, Carne Molida, Cheddar)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-xl border border-input bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Quick Filter Tabs */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              statusFilter === "ALL"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Todos ({rawMaterials.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("CRITICAL")}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              statusFilter === "CRITICAL"
                ? "bg-rose-500 text-white shadow-xs"
                : "bg-card border border-border text-rose-500 hover:bg-rose-500/10"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Críticos ({lowStockCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("OUT_OF_STOCK")}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              statusFilter === "OUT_OF_STOCK"
                ? "bg-zinc-800 text-white shadow-xs"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Agotados ({outOfStockCount})
          </button>
        </div>
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
                    No se encontraron insumos de cocina registrados con este filtro.
                  </td>
                </tr>
              ) : (
                filteredMaterials.map((item) => {
                  const isLow = item.current_stock <= item.min_alert_stock;
                  const isOut = item.current_stock <= 0;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-muted/40 transition-colors ${
                        isOut ? "bg-zinc-500/10" : isLow ? "bg-rose-500/5" : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-foreground">{item.name}</div>
                        {item.sku && (
                          <div className="text-[10px] font-mono text-muted-foreground">
                            SKU: {item.sku}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-muted-foreground">
                        {item.unit}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-black font-mono px-2 py-0.5 rounded-md ${
                            isOut
                              ? "bg-zinc-800 text-zinc-300"
                              : isLow
                              ? "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                              : "text-foreground"
                          }`}
                        >
                          {item.current_stock} {item.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground font-mono">
                        {item.min_alert_stock} {item.unit}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-foreground">
                        {formatCurrency(item.cost_per_unit_usd, "USD")}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleQuickAdjust(item, -1)}
                            className="w-6 h-6 rounded bg-muted hover:bg-muted/80 text-foreground font-black flex items-center justify-center cursor-pointer transition-colors"
                            title="-1 unidad"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickAdjust(item, 1)}
                            className="w-6 h-6 rounded bg-muted hover:bg-muted/80 text-foreground font-black flex items-center justify-center cursor-pointer transition-colors"
                            title="+1 unidad"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickAdjust(item, 10)}
                            className="px-1.5 h-6 rounded bg-primary/10 hover:bg-primary/20 text-primary font-bold text-[10px] flex items-center justify-center cursor-pointer transition-colors"
                            title="+10 unidades"
                          >
                            +10
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openRestockModal(item)}
                            className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10 cursor-pointer transition-colors"
                            title="Entrada de mercancía / Reabastecer"
                          >
                            <ArrowDownToLine className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="p-1.5 rounded-lg text-primary hover:bg-primary/10 cursor-pointer transition-colors"
                            title="Editar insumo"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteRawMaterial(item.id)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer transition-colors"
                            title="Eliminar insumo"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Edit / Create Raw Material Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
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
                    <option value="ML">Mililitros</option>
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

      {/* Restock / Supplier Intake Modal */}
      {isRestockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsRestockModalOpen(false)}
          />
          <div className="relative w-full max-w-md bg-card text-foreground rounded-2xl border border-border shadow-2xl p-5 z-10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                <ArrowDownToLine className="w-4 h-4 text-emerald-500" />
                <span>Entrada de Mercancía / Reabastecimiento</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsRestockModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-muted-foreground block mb-1">
                  Insumo que entra:
                </label>
                <select
                  value={restockMaterialId}
                  onChange={(e) => {
                    setRestockMaterialId(e.target.value);
                    const it = rawMaterials.find((r) => r.id === e.target.value);
                    if (it) setRestockNewUnitCost(it.cost_per_unit_usd);
                  }}
                  className="w-full h-9 px-3 rounded-xl border border-input bg-background font-bold"
                >
                  {rawMaterials.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} (Stock actual: {r.current_stock} {r.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">
                    Cantidad Recibida:
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={restockQuantity}
                    onChange={(e) => setRestockQuantity(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 px-3 rounded-xl border border-input bg-background font-black"
                  />
                </div>

                <div>
                  <label className="font-bold text-muted-foreground block mb-1">
                    Nuevo Costo Compra ($):
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={restockNewUnitCost}
                    onChange={(e) => setRestockNewUnitCost(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 px-3 rounded-xl border border-input bg-background font-black"
                  />
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-xl border border-border">
                💡 Esta entrada sumará directamente la cantidad al stock de almacén y actualizará el costo unitario para el cálculo del Food Cost.
              </p>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRestockModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-500 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? "Registrando..." : "Confirmar Entrada"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
