"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import type {
  CraftMaterial,
  CraftMaterialCategory,
  CraftRecipe,
  WorkshopTechnique,
  CraftQuote,
  CreateCraftRecipeInput,
  UpdateCraftRecipeInput,
  CreateCraftMaterialInput,
  UpdateCraftMaterialInput,
  CreateCraftQuoteInput,
  RecalculateCraftRecipesResult,
} from "@marketos/types";
import { CraftRecipeCatalog } from "./CraftRecipeCatalog";
import { CraftPricingCalculator } from "./CraftPricingCalculator";
import { CraftMaterialsManager } from "./CraftMaterialsManager";
import { CraftQuoteBuilder } from "./CraftQuoteBuilder";
import {
  Printer,
  Calculator,
  Boxes,
  MessageSquare,
  Sparkles,
  Loader2,
  AlertTriangle,
  Plus,
} from "lucide-react";

export interface CraftWorkshopActions {
  getMaterials?: (category?: CraftMaterialCategory) => Promise<{ success: boolean; data?: CraftMaterial[]; error?: string }>;
  createMaterial?: (input: Omit<CreateCraftMaterialInput, "tenantId">) => Promise<{ success: boolean; material?: CraftMaterial; error?: string }>;
  updateMaterial?: (input: Omit<UpdateCraftMaterialInput, "tenantId">) => Promise<{ success: boolean; material?: CraftMaterial; error?: string }>;
  deleteMaterial?: (materialId: string) => Promise<{ success: boolean; error?: string }>;
  getRecipes?: (options?: { technique?: WorkshopTechnique; isActive?: boolean }) => Promise<{ success: boolean; data?: CraftRecipe[]; error?: string }>;
  createRecipe?: (input: Omit<CreateCraftRecipeInput, "tenantId">) => Promise<{ success: boolean; recipe?: CraftRecipe; error?: string }>;
  updateRecipe?: (input: Omit<UpdateCraftRecipeInput, "tenantId">) => Promise<{ success: boolean; recipe?: CraftRecipe; error?: string }>;
  deleteRecipe?: (recipeId: string) => Promise<{ success: boolean; error?: string }>;
  recalculateRecipes?: (syncStorefront?: boolean) => Promise<{ success: boolean; result?: RecalculateCraftRecipesResult; error?: string }>;
  publishRecipe?: (recipeId: string) => Promise<{ success: boolean; product?: any; recipe?: CraftRecipe; error?: string }>;
  unpublishRecipe?: (recipeId: string) => Promise<{ success: boolean; error?: string }>;
  getQuotes?: (limit?: number) => Promise<{ success: boolean; data?: CraftQuote[]; error?: string }>;
  createQuote?: (input: Omit<CreateCraftQuoteInput, "tenantId">) => Promise<{ success: boolean; quote?: CraftQuote; error?: string }>;
  convertQuoteToOrder?: (quoteId: string) => Promise<{ success: boolean; order?: any; error?: string }>;
}

export interface CraftWorkshopAdminPanelProps {
  tenantId: string;
  exchangeRate?: number;
  currencySymbol?: string;
  businessName?: string;
  businessPhone?: string;
  initialMaterials?: CraftMaterial[];
  initialRecipes?: CraftRecipe[];
  initialQuotes?: CraftQuote[];
  actions?: CraftWorkshopActions;
}

type WorkshopTab = "CATALOG" | "CALCULATOR" | "MATERIALS" | "QUOTES";

export function CraftWorkshopAdminPanel({
  tenantId,
  exchangeRate = 1,
  currencySymbol = "$",
  businessName = "Printopink Taller Creativo",
  businessPhone = "",
  initialMaterials,
  initialRecipes,
  initialQuotes,
  actions,
}: CraftWorkshopAdminPanelProps) {
  const [activeTab, setActiveTab] = useState<WorkshopTab>("CATALOG");
  const [materials, setMaterials] = useState<CraftMaterial[]>(initialMaterials || []);
  const [recipes, setRecipes] = useState<CraftRecipe[]>(initialRecipes || []);
  const [quotes, setQuotes] = useState<CraftQuote[]>(initialQuotes || []);
  const [isLoading, setIsLoading] = useState(!initialMaterials && !initialRecipes);

  const [editingRecipe, setEditingRecipe] = useState<CraftRecipe | null>(null);
  const [recipeForQuote, setRecipeForQuote] = useState<CraftRecipe | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const loadWorkshopData = async () => {
    if (!actions) return;
    setIsLoading(true);
    try {
      const [matRes, recRes, quoRes] = await Promise.all([
        actions.getMaterials
          ? actions.getMaterials()
          : Promise.resolve({ success: false, data: undefined }),
        actions.getRecipes
          ? actions.getRecipes()
          : Promise.resolve({ success: false, data: undefined }),
        actions.getQuotes
          ? actions.getQuotes(50)
          : Promise.resolve({ success: false, data: undefined }),
      ]);

      if (matRes.success && matRes.data) setMaterials(matRes.data);
      if (recRes.success && recRes.data) setRecipes(recRes.data);
      if (quoRes.success && quoRes.data) setQuotes(quoRes.data);
    } catch (err) {
      console.error("[CraftWorkshopAdminPanel] Error al cargar datos:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!initialMaterials || !initialRecipes) {
      loadWorkshopData();
    }
  }, [tenantId]);

  const pendingRecalcCount = recipes.filter((r) => r.has_pending_recalc).length;

  const handleRecalculateAll = async (syncStorefront = true) => {
    if (!actions?.recalculateRecipes) return;
    setIsRecalculating(true);
    try {
      const res = await actions.recalculateRecipes(syncStorefront);
      if (res.success && res.result) {
        toast.success(
          `¡Recálculo exitoso! ${res.result.updated_recipes} recetas actualizadas, ${res.result.synced_products} productos en vitrina sincronizados.`
        );
        await loadWorkshopData();
      } else {
        toast.error(res.error || "No se pudo completar el recálculo masivo.");
      }
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleSaveRecipe = async (payload: any): Promise<boolean> => {
    if (!actions) return false;
    try {
      if (payload.recipeId && actions.updateRecipe) {
        const res = await actions.updateRecipe(payload);
        if (!res.success) {
          toast.error(res.error || "Error al actualizar la ficha técnica");
          return false;
        }
        toast.success("Ficha técnica actualizada con éxito");
      } else if (actions.createRecipe) {
        const res = await actions.createRecipe(payload);
        if (!res.success) {
          toast.error(res.error || "Error al registrar la ficha técnica");
          return false;
        }
        toast.success("Ficha técnica creada con éxito");
      }

      await loadWorkshopData();
      setEditingRecipe(null);
      setActiveTab("CATALOG");
      return true;
    } catch {
      toast.error("Error inesperado al guardar receta");
      return false;
    }
  };

  const handleTogglePublish = async (recipeId: string, shouldPublish: boolean) => {
    if (!actions) return;
    try {
      if (shouldPublish && actions.publishRecipe) {
        const res = await actions.publishRecipe(recipeId);
        if (!res.success) {
          toast.error(res.error || "Error al publicar producto en vitrina online");
          return;
        }
        toast.success("Producto publicado en vitrina online con éxito");
      } else if (!shouldPublish && actions.unpublishRecipe) {
        const res = await actions.unpublishRecipe(recipeId);
        if (!res.success) {
          toast.error(res.error || "Error al retirar producto de vitrina online");
          return;
        }
        toast.info("Producto retirado de vitrina online");
      }
      await loadWorkshopData();
    } catch {
      toast.error("Error al cambiar estado de publicación");
    }
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    if (!actions?.deleteRecipe) return;
    if (!confirm("¿Está seguro de desactivar esta ficha técnica?")) return;
    try {
      await actions.deleteRecipe(recipeId);
      toast.success("Ficha técnica desactivada con éxito");
      await loadWorkshopData();
    } catch {
      toast.error("Error al eliminar receta");
    }
  };

  const handleQuoteRecipe = (recipe: CraftRecipe) => {
    setRecipeForQuote(recipe);
    setActiveTab("QUOTES");
  };

  const handleSelectRecipeForEdit = (recipe: CraftRecipe) => {
    setEditingRecipe(recipe);
    setActiveTab("CALCULATOR");
  };

  const handleCreateMaterial = async (input: Omit<CreateCraftMaterialInput, "tenantId">) => {
    if (!actions?.createMaterial) return false;
    const res = await actions.createMaterial(input);
    if (res.success) {
      toast.success("Insumo registrado con éxito");
      await loadWorkshopData();
      return true;
    }
    toast.error(res.error || "Error al registrar insumo");
    return false;
  };

  const handleUpdateMaterial = async (input: Omit<UpdateCraftMaterialInput, "tenantId">) => {
    if (!actions?.updateMaterial) return false;
    const res = await actions.updateMaterial(input);
    if (res.success) {
      toast.success("Insumo actualizado con éxito");
      await loadWorkshopData();
      return true;
    }
    toast.error(res.error || "Error al actualizar insumo");
    return false;
  };

  const handleDeleteMaterial = async (materialId: string) => {
    if (!actions?.deleteMaterial) return false;
    const res = await actions.deleteMaterial(materialId);
    if (res.success) {
      toast.success("Insumo eliminado con éxito");
      await loadWorkshopData();
      return true;
    }
    toast.error(res.error || "Error al eliminar insumo");
    return false;
  };

  const handleCreateQuote = async (input: Omit<CreateCraftQuoteInput, "tenantId">) => {
    if (!actions?.createQuote) return null;
    const res = await actions.createQuote(input);
    if (res.success && res.quote) {
      toast.success(`Cotización ${res.quote.quote_number} generada con éxito`);
      await loadWorkshopData();
      return res.quote;
    }
    toast.error(res.error || "Error al registrar cotización");
    return null;
  };

  const handleConvertToOrder = async (quoteId: string) => {
    if (!actions?.convertQuoteToOrder) return false;
    const res = await actions.convertQuoteToOrder(quoteId);
    if (res.success) {
      toast.success("¡Cotización convertida con éxito en Pedido Oficial de Taller!");
      await loadWorkshopData();
      return true;
    }
    toast.error(res.error || "No se pudo convertir la cotización a pedido");
    return false;
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Integrado de Taller (Estilo Unificado con el Dashboard de MarketOS) */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Taller de Personalización
            </span>
            {pendingRecalcCount > 0 && (
              <span className="px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold rounded-full flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                {pendingRecalcCount} recálculos pendientes
              </span>
            )}
            <span className="text-xs text-muted-foreground font-semibold">
              Tasa Oficial: Bs. {exchangeRate.toFixed(2)}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <Printer className="w-7 h-7 text-primary" />
            Taller de Sublimación, DTF & Artes Gráficas
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground font-medium max-w-3xl">
            Costeo unitario por bultos, merma operativa de máquina, recálculo atómico ante inflación y presupuestos WhatsApp con 50% de anticipo.
          </p>
        </div>

        {/* Acceso Rápido a Nueva Ficha */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setEditingRecipe(null);
              setActiveTab("CALCULATOR");
            }}
            className="h-11 px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-primary/20 transition flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Ficha Técnica</span>
          </button>
        </div>
      </div>

      {/* 2. Pestañas de Navegación del Taller (Botones Grandes y Cómodos) */}
      <div className="flex items-center gap-2.5 border-b border-border pb-3 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => {
            setEditingRecipe(null);
            setActiveTab("CATALOG");
          }}
          className={`h-11 px-4 sm:px-5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 shadow-2xs ${
            activeTab === "CATALOG"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]"
              : "bg-card border border-border text-foreground hover:bg-muted"
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>1. Catálogo de Fichas ({recipes.length})</span>
          {pendingRecalcCount > 0 && (
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("CALCULATOR")}
          className={`h-11 px-4 sm:px-5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 shadow-2xs ${
            activeTab === "CALCULATOR"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]"
              : "bg-card border border-border text-foreground hover:bg-muted"
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>2. Calculadora de Costos Directos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("MATERIALS")}
          className={`h-11 px-4 sm:px-5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 shadow-2xs ${
            activeTab === "MATERIALS"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]"
              : "bg-card border border-border text-foreground hover:bg-muted"
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>3. Insumos por Bulto ({materials.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("QUOTES")}
          className={`h-11 px-4 sm:px-5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 shadow-2xs ${
            activeTab === "QUOTES"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]"
              : "bg-card border border-border text-foreground hover:bg-muted"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>4. Cotizador WhatsApp ({quotes.length})</span>
        </button>
      </div>

      {/* 3. Contenido Principal por Pestaña */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
          <p className="text-xs sm:text-sm text-muted-foreground font-medium">Cargando datos del taller...</p>
        </div>
      ) : (
        <div>
          {activeTab === "CATALOG" && (
            <CraftRecipeCatalog
              recipes={recipes}
              onSelectRecipeForEdit={handleSelectRecipeForEdit}
              onNewRecipeClick={() => {
                setEditingRecipe(null);
                setActiveTab("CALCULATOR");
              }}
              onRecalculateAll={handleRecalculateAll}
              onTogglePublish={handleTogglePublish}
              onDeleteRecipe={handleDeleteRecipe}
              onQuoteRecipe={handleQuoteRecipe}
              currencySymbol={currencySymbol}
              exchangeRate={exchangeRate}
              isRecalculating={isRecalculating}
            />
          )}

          {activeTab === "CALCULATOR" && (
            <CraftPricingCalculator
              tenantId={tenantId}
              materials={materials}
              initialRecipe={editingRecipe}
              onSaveRecipe={handleSaveRecipe}
              onCancel={() => {
                setEditingRecipe(null);
                setActiveTab("CATALOG");
              }}
              currencySymbol={currencySymbol}
              exchangeRate={exchangeRate}
            />
          )}

          {activeTab === "MATERIALS" && (
            <CraftMaterialsManager
              tenantId={tenantId}
              materials={materials}
              onCreateMaterial={handleCreateMaterial}
              onUpdateMaterial={handleUpdateMaterial}
              onDeleteMaterial={handleDeleteMaterial}
              currencySymbol={currencySymbol}
              exchangeRate={exchangeRate}
            />
          )}

          {activeTab === "QUOTES" && (
            <CraftQuoteBuilder
              tenantId={tenantId}
              recipes={recipes}
              quotes={quotes}
              exchangeRate={exchangeRate}
              businessName={businessName}
              businessPhone={businessPhone}
              currencySymbol={currencySymbol}
              initialRecipeForQuote={recipeForQuote}
              onCreateQuote={handleCreateQuote}
              onConvertToOrder={handleConvertToOrder}
            />
          )}
        </div>
      )}
    </div>
  );
}
