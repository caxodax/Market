"use client";

import React, { useState, useMemo } from "react";
import type { CraftRecipe, WorkshopTechnique } from "@marketos/types";
import { convertBimonetary } from "../services/craft-pricing-engine";
import {
  Printer,
  Search,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Edit3,
  MessageSquare,
  Sparkles,
  Plus,
  Trash2,
  Tag,
  CheckCircle2,
  Coffee,
  Shirt,
  Scissors,
  Gift,
  Package,
} from "lucide-react";

export interface CraftRecipeCatalogProps {
  recipes: CraftRecipe[];
  onSelectRecipeForEdit: (recipe: CraftRecipe) => void;
  onNewRecipeClick: () => void;
  onRecalculateAll: (syncStorefront: boolean) => Promise<void>;
  onTogglePublish: (recipeId: string, shouldPublish: boolean) => Promise<void>;
  onDeleteRecipe: (recipeId: string) => Promise<void>;
  onQuoteRecipe: (recipe: CraftRecipe) => void;
  currencySymbol?: string;
  exchangeRate?: number;
  isRecalculating?: boolean;
}

const TECHNIQUE_FILTERS: {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "all", label: "Todas las Fichas", icon: Sparkles },
  { id: "sublimacion", label: "Sublimación", icon: Coffee },
  { id: "dtf", label: "DTF Textil", icon: Shirt },
  { id: "vinil", label: "Vinil", icon: Scissors },
  { id: "papeleria", label: "Papelería & Etiquetas", icon: Tag },
  { id: "esferas", label: "Esferas Navideñas", icon: Gift },
  { id: "general", label: "General", icon: Package },
];

export function CraftRecipeCatalog({
  recipes,
  onSelectRecipeForEdit,
  onNewRecipeClick,
  onRecalculateAll,
  onTogglePublish,
  onDeleteRecipe,
  onQuoteRecipe,
  currencySymbol = "$",
  exchangeRate = 1,
  isRecalculating = false,
}: CraftRecipeCatalogProps) {
  const [search, setSearch] = useState("");
  const [selectedTechnique, setSelectedTechnique] = useState("all");

  const pendingRecalcCount = useMemo(
    () => recipes.filter((r) => r.has_pending_recalc).length,
    [recipes]
  );

  const filteredRecipes = useMemo(() => {
    return recipes.filter((r) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.sku && r.sku.toLowerCase().includes(q)) ||
        (r.category_name && r.category_name.toLowerCase().includes(q));

      const matchesTechnique =
        selectedTechnique === "all" || r.technique === selectedTechnique;

      return matchesSearch && matchesTechnique;
    });
  }, [recipes, search, selectedTechnique]);

  return (
    <div className="space-y-6">
      {/* ⚠️ BANNER DE ALERTA DE INFLACIÓN (RECÁLCULO MASIVO PENDIENTE) */}
      {pendingRecalcCount > 0 && (
        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-black text-amber-950 dark:text-amber-200">
                ¡Alerta de Rentabilidad! {pendingRecalcCount} {pendingRecalcCount === 1 ? "receta tiene" : "recetas tienen"} costos pendientes de recálculo
              </h4>
              <p className="text-xs sm:text-sm text-amber-900/80 dark:text-amber-300/80 font-medium mt-0.5">
                Subió el precio de compra de materia prima. Ejecuta el recálculo atómico en &lt; 5 ms para proteger tu margen neto.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isRecalculating}
            onClick={() => onRecalculateAll(true)}
            className="w-full sm:w-auto px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isRecalculating ? "animate-spin" : ""}`} />
            <span>{isRecalculating ? "Recalculando..." : "Recalcular Precios Masivamente"}</span>
          </button>
        </div>
      )}

      {/* Barra de Filtros & Buscador (Estilo Catálogo) */}
      <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Buscador */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por producto, técnica o SKU..."
            className="w-full h-11 pl-11 pr-4 rounded-xl border border-border bg-background text-foreground text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition placeholder:text-muted-foreground/60"
          />
        </div>

        {/* Botón Nueva Ficha */}
        <button
          type="button"
          onClick={onNewRecipeClick}
          className="w-full md:w-auto h-11 px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-primary/20 transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Ficha de Costeo</span>
        </button>
      </div>

      {/* Píldoras de Técnicas */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {TECHNIQUE_FILTERS.map((tech) => {
          const isActive = selectedTechnique === tech.id;
          const IconComp = tech.icon;
          return (
            <button
              key={tech.id}
              type="button"
              onClick={() => setSelectedTechnique(tech.id)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-2xs ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]"
                  : "bg-card border border-border text-foreground hover:bg-muted"
              }`}
            >
              <IconComp className="w-4 h-4" />
              <span>{tech.label}</span>
            </button>
          );
        })}
      </div>

      {/* Grilla de Fichas de Recetas */}
      {filteredRecipes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-12 sm:p-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
            <Printer className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-foreground">
              No se encontraron fichas de costeo
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
              Crea tu primera ficha técnica para calcular costos de bultos, merma y precio sugerido en USD y Bolívares.
            </p>
          </div>
          <button
            type="button"
            onClick={onNewRecipeClick}
            className="px-5 py-2.5 bg-primary text-primary-foreground text-xs sm:text-sm font-bold rounded-xl shadow cursor-pointer"
          >
            Crear Primera Ficha
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRecipes.map((recipe) => {
            const itemsCount = recipe.items?.length || 0;
            const priceVes = convertBimonetary(recipe.selling_price_base, exchangeRate);
            const costVes = convertBimonetary(recipe.direct_cost_base, exchangeRate);

            return (
              <div
                key={recipe.id}
                className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
              >
                {/* Cabecera de la Ficha */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[11px] font-bold uppercase tracking-wider inline-block">
                        {recipe.technique}
                      </span>
                      <h3 className="text-base sm:text-lg font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                        {recipe.name}
                      </h3>
                      {recipe.sku && (
                        <span className="text-xs text-muted-foreground font-mono font-semibold block">
                          SKU: {recipe.sku}
                        </span>
                      )}
                    </div>

                    {/* Badges de Estado */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {recipe.has_pending_recalc && (
                        <span className="px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-black rounded-full flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Desactualizado
                        </span>
                      )}
                      {recipe.is_published ? (
                        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          En Vitrina
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-muted text-muted-foreground text-[10px] font-bold rounded-full">
                          Solo Taller
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Resumen de Insumos */}
                  <div className="text-xs text-muted-foreground pt-1 flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-primary" />
                    <span className="font-semibold">{itemsCount} {itemsCount === 1 ? "insumo asignado" : "insumos asignados"}</span>
                    <span>•</span>
                    <span>Merma: <strong className="text-foreground">{recipe.waste_percentage}%</strong></span>
                  </div>
                </div>

                {/* Desglose Económico (KPIs con Dual Currency) */}
                <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-2.5">
                  <div className="grid grid-cols-2 gap-3 pb-2.5 border-b border-border/60">
                    <div>
                      <span className="text-[11px] uppercase font-bold text-muted-foreground block">Costo Directo</span>
                      <span className="text-sm sm:text-base font-black text-foreground font-mono">
                        {currencySymbol}{recipe.direct_cost_base.toFixed(2)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] uppercase font-bold text-primary block">PVP Sugerido</span>
                      <div className="flex flex-col">
                        <span className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                          {currencySymbol}{recipe.selling_price_base.toFixed(2)}
                        </span>
                        <span className="text-xs font-mono font-bold text-muted-foreground">
                          Bs. {priceVes.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs sm:text-sm pt-0.5">
                    <span className="text-muted-foreground font-medium">Ganancia Neta:</span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      +{currencySymbol}{recipe.profit_base.toFixed(2)} ({recipe.margin_percentage}% neto)
                    </span>
                  </div>
                </div>

                {/* Acciones de la Tarjeta */}
                <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSelectRecipeForEdit(recipe)}
                      className="p-2.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition cursor-pointer"
                      title="Editar ficha técnica"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onTogglePublish(recipe.id, !recipe.is_published)}
                      className={`p-2.5 rounded-xl transition cursor-pointer ${
                        recipe.is_published
                          ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                      title={recipe.is_published ? "Retirar de vitrina online" : "Publicar en vitrina online de clientes"}
                    >
                      {recipe.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteRecipe(recipe.id)}
                      className="p-2.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition cursor-pointer"
                      title="Desactivar ficha"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onQuoteRecipe(recipe)}
                    className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Cotizar WhatsApp</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
