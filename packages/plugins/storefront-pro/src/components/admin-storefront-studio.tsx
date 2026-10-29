"use client";

import React, { useState } from "react";
import {
  StorefrontConfig,
  StorefrontBlock,
  Category,
  Product,
  Store,
  ExchangeRate,
} from "@marketos/types";
import {
  Layers,
  Eye,
  Smartphone,
  Monitor,
  ArrowUp,
  ArrowDown,
  Check,
  RotateCcw,
  Sliders,
  ChevronDown,
  ChevronUp,
  Settings2,
  Save,
  Globe,
  Sparkles,
} from "lucide-react";
import { createDefaultStorefrontConfig, createVenezuelaStorefrontConfig, ensureCatalogBlock } from "../defaults";
import { StorefrontProRenderer } from "./storefront-pro-renderer";
import { BlockConfigForm } from "./block-config-forms";

interface AdminStorefrontStudioProps {
  initialConfig?: StorefrontConfig | null;
  businessName: string;
  categories: Category[];
  products: (Product & { stock: number })[];
  stores: Store[];
  exchangeRate: ExchangeRate;
  onSave: (config: StorefrontConfig) => Promise<void>;
}

export function AdminStorefrontStudio({
  initialConfig,
  businessName,
  categories,
  products,
  stores,
  exchangeRate,
  onSave,
}: AdminStorefrontStudioProps) {
  const [config, setConfig] = useState<StorefrontConfig>(() => {
    const raw = initialConfig && initialConfig.blocks && initialConfig.blocks.length > 0
      ? initialConfig
      : createDefaultStorefrontConfig(businessName);
    return {
      ...raw,
      blocks: ensureCatalogBlock(raw.blocks),
    };
  });

  const [previewDevice, setPreviewDevice] = useState<"mobile" | "desktop">("mobile");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);

  // Toggle block enabled/disabled
  const handleToggleBlock = (blockId: string) => {
    const targetBlock = config.blocks.find((b) => b.id === blockId);
    if (targetBlock?.type === "catalog_grid") return; // The catalog is the shopping core and cannot be disabled

    setConfig((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === blockId ? { ...b, enabled: !b.enabled } : b)),
    }));
    setHasUnsavedChanges(true);
  };

  // Move block up or down
  const handleMoveBlock = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === config.blocks.length - 1)
    ) {
      return;
    }

    const newBlocks = [...config.blocks];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[targetIndex];
    newBlocks[targetIndex] = temp;

    // Re-assign order numbers
    newBlocks.forEach((b, idx) => {
      b.order = idx + 1;
    });

    setConfig((prev) => ({ ...prev, blocks: newBlocks }));
    setHasUnsavedChanges(true);
  };

  // Update specific block configuration
  const handleUpdateBlockConfig = (blockId: string, updatedConfig: any) => {
    setConfig((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === blockId ? { ...b, config: updatedConfig } : b)),
    }));
    setHasUnsavedChanges(true);
  };

  // Reset to default layout
  const handleApplyPreset = (preset: "global" | "venezuela") => {
    const label = preset === "venezuela" ? "Venezuela (BCV & Pagos Locales)" : "Global E-Commerce";
    if (confirm(`¿Deseas inicializar todos los bloques con la plantilla ${label}?`)) {
      setConfig(
        preset === "venezuela"
          ? createVenezuelaStorefrontConfig(businessName)
          : createDefaultStorefrontConfig({ businessName, preset: "global" })
      );
      setHasUnsavedChanges(true);
    }
  };

  // Save changes
  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onSave(config);
      setSaveSuccess(true);
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert("Error al guardar la configuración de la vitrina.");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedStore = stores[0] || {
    id: "default",
    tenant_id: "default",
    name: "Sede Principal",
    code: "SP-01",
    address: "Sede Principal",
    phone: null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">
              Vitrina Visual Pro & Studio
            </h2>
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Live Modular
            </span>
            {hasUnsavedChanges && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                • Cambios sin guardar
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Activa, reorganiza y edita en vivo los 10 bloques visuales de tu tienda pública.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Preset selector */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-xl text-xs">
            <span className="text-[11px] font-semibold text-muted-foreground px-1.5 flex items-center gap-1">
              <Globe className="w-3 h-3" />
              <span>Plantilla:</span>
            </span>
            <button
              type="button"
              onClick={() => handleApplyPreset("global")}
              className="px-2 py-1 rounded-lg text-[11px] font-bold hover:bg-background transition-colors text-foreground cursor-pointer"
            >
              Global
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset("venezuela")}
              className="px-2 py-1 rounded-lg text-[11px] font-bold hover:bg-background transition-colors text-foreground cursor-pointer"
            >
              Venezuela
            </button>
          </div>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveConfig}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-extrabold hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <span>Guardando...</span>
            ) : saveSuccess ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>¡Publicado!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Guardar Cambios</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout: Left Controls + Right Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Blocks Manager (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-primary" />
                <span>Estructura de la Tienda ({config.blocks.filter((b) => b.enabled).length} Activos)</span>
              </span>
              <span className="text-[11px] text-muted-foreground">
                Haz clic en <Settings2 className="w-3 h-3 inline text-primary" /> para editar
              </span>
            </div>

            {/* List of 10 Blocks with Expandable Configuration Drawers */}
            <div className="space-y-2">
              {config.blocks.map((block, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === config.blocks.length - 1;
                const isExpanded = expandedBlockId === block.id;
                const isCatalog = block.type === "catalog_grid";

                return (
                  <div
                    key={block.id}
                    className={`rounded-xl border transition-all overflow-hidden ${
                      isCatalog
                        ? "border-primary/50 bg-primary/5 shadow-xs ring-1 ring-primary/20"
                        : block.enabled
                        ? isExpanded
                          ? "border-primary/60 bg-card shadow-sm ring-1 ring-primary/20"
                          : "border-border bg-card shadow-2xs"
                        : "border-dashed border-border/60 bg-muted/30 opacity-60"
                    }`}
                  >
                    {/* Header Row */}
                    <div className="p-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Order Handle */}
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            disabled={isFirst}
                            onClick={() => handleMoveBlock(idx, "up")}
                            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                            title="Subir bloque"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isLast}
                            onClick={() => handleMoveBlock(idx, "down")}
                            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                            title="Bajar bloque"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Block Info */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-bold truncate ${isCatalog ? "text-primary font-black" : "text-foreground"}`}>
                              {block.label}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              #{block.order}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground block truncate">
                            {isCatalog ? (
                              <span className="text-primary/90 font-medium">
                                Núcleo de Compra • Buscador, Categorías, Productos y Carrito
                              </span>
                            ) : (
                              <>Tipo: <code className="font-mono">{block.type}</code></>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Right Action: Configure Button + Enable/Disable Switch */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Configure / Edit Content Button */}
                        <button
                          type="button"
                          onClick={() => setExpandedBlockId(isExpanded ? null : block.id)}
                          className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                            isExpanded
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                          }`}
                          title="Editar contenidos del bloque"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Editar</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>

                        {/* Enable / Disable Toggle Switch or Core Badge */}
                        {isCatalog ? (
                          <span
                            className="px-2.5 py-1 rounded-full bg-primary/15 text-primary text-[10px] font-black uppercase tracking-wider shadow-2xs select-none"
                            title="El catálogo de productos es el corazón de tu tienda y siempre permanece activo"
                          >
                            Núcleo Activo
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleBlock(block.id)}
                            className={`w-11 h-6 rounded-full transition-colors p-0.5 relative cursor-pointer ${
                              block.enabled ? "bg-primary" : "bg-muted-foreground/30"
                            }`}
                            title={block.enabled ? "Desactivar bloque" : "Activar bloque"}
                          >
                            <div
                              className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                                block.enabled ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable Configuration Drawer */}
                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 pt-1 border-t border-border/80 bg-muted/20 animate-in fade-in duration-200">
                        <BlockConfigForm
                          block={block}
                          categories={categories}
                          products={products}
                          onChange={(updated) => handleUpdateBlockConfig(block.id, updated)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Preview (7 cols) */}
        <div className="lg:col-span-7 flex flex-col items-center sticky top-4">
          {/* Device Switcher */}
          <div className="flex items-center gap-2 mb-3 bg-muted p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setPreviewDevice("mobile")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                previewDevice === "mobile"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Móvil (390px)</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice("desktop")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                previewDevice === "desktop"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Escritorio (100%)</span>
            </button>
          </div>

          {/* Simulator Container */}
          <div
            className={`w-full transition-all duration-300 ${
              previewDevice === "mobile"
                ? "max-w-[400px] border-8 border-zinc-800 rounded-[40px] shadow-2xl p-0 overflow-hidden bg-background"
                : "w-full border border-border rounded-2xl shadow-md overflow-hidden bg-background"
            }`}
          >
            {/* Top Device Notch for Mobile */}
            {previewDevice === "mobile" && (
              <div className="w-full bg-zinc-800 h-6 flex items-center justify-center">
                <div className="w-20 h-3.5 bg-black rounded-full" />
              </div>
            )}

            <div className="max-h-[680px] overflow-y-auto no-scrollbar pb-10">
              {/* Top Marquee */}
              <StorefrontProRenderer
                config={config}
                position="top"
                categories={categories}
                products={products}
                selectedStore={selectedStore}
                exchangeRate={exchangeRate}
                selectedCategoryId={null}
                onSelectCategory={() => {}}
                onAddToCart={() => {}}
              />

              {/* Mock Mini Header */}
              <div className="p-3 border-b border-border bg-card flex items-center justify-between">
                <span className="font-black text-xs text-foreground tracking-tight">
                  {businessName}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                  Vista Previa en Vivo
                </span>
              </div>

              {/* Body Blocks */}
              <StorefrontProRenderer
                config={config}
                position="body"
                categories={categories}
                products={products}
                selectedStore={selectedStore}
                exchangeRate={exchangeRate}
                selectedCategoryId={null}
                onSelectCategory={() => {}}
                onAddToCart={() => {}}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
