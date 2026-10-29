"use client";

import React from "react";
import {
  StorefrontBlock,
  Category,
  Product,
  AnnouncementMarqueeConfig,
  HeroSliderConfig,
  CategoryBubblesConfig,
  FlashSaleConfig,
  FeaturedRailsConfig,
  ProductReelsConfig,
  TrustBadgesConfig,
  TestimonialsConfig,
  BrandStoryConfig,
  FaqAccordionConfig,
} from "@marketos/types";
import { Plus, Trash2, Image, Link, Clock, Star, Tag, MessageSquare, AlertCircle } from "lucide-react";

interface BlockConfigFormProps {
  block: StorefrontBlock;
  categories: Category[];
  products: (Product & { stock: number })[];
  onChange: (updatedConfig: any) => void;
}

export function BlockConfigForm({
  block,
  categories,
  products,
  onChange,
}: BlockConfigFormProps) {
  switch (block.type) {
    case "announcement_marquee":
      return (
        <AnnouncementMarqueeForm
          config={block.config as AnnouncementMarqueeConfig}
          onChange={onChange}
        />
      );

    case "hero_slider":
      return (
        <HeroSliderForm
          config={block.config as HeroSliderConfig}
          categories={categories}
          onChange={onChange}
        />
      );

    case "category_bubbles":
      return (
        <CategoryBubblesForm
          config={block.config as CategoryBubblesConfig}
          onChange={onChange}
        />
      );

    case "flash_sale":
      return (
        <FlashSaleForm
          config={block.config as FlashSaleConfig}
          categories={categories}
          onChange={onChange}
        />
      );

    case "featured_rails":
      return (
        <FeaturedRailsForm
          config={block.config as FeaturedRailsConfig}
          categories={categories}
          onChange={onChange}
        />
      );

    case "product_reels":
      return (
        <ProductReelsForm
          config={block.config as ProductReelsConfig}
          onChange={onChange}
        />
      );

    case "trust_badges":
      return (
        <TrustBadgesForm
          config={block.config as TrustBadgesConfig}
          onChange={onChange}
        />
      );

    case "testimonials":
      return (
        <TestimonialsForm
          config={block.config as TestimonialsConfig}
          onChange={onChange}
        />
      );

    case "brand_story":
      return (
        <BrandStoryForm
          config={block.config as BrandStoryConfig}
          onChange={onChange}
        />
      );

    case "faq_accordion":
      return (
        <FaqAccordionForm
          config={block.config as FaqAccordionConfig}
          onChange={onChange}
        />
      );

    case "catalog_grid":
      return (
        <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-xs space-y-1.5">
          <p className="font-extrabold text-foreground flex items-center gap-1.5">
            <span>🛍️ Núcleo de la Tienda (Catálogo & Carrito)</span>
          </p>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            Este bloque representa tu buscador, menú de categorías, cuadrícula de productos y el carrito de compra lateral fijo.
          </p>
          <div className="pt-1 text-[11px] text-primary font-bold">
            💡 Consejo: Utiliza las flechas ⬆️ / ⬇️ en la lista para organizar libremente qué secciones de Vitrina Pro deseas ver antes o después del catálogo.
          </div>
        </div>
      );

    default:
      return (
        <p className="text-xs text-muted-foreground italic">
          No hay opciones de configuración adicionales para este bloque.
        </p>
      );
  }
}

// 1. Ticker / Marquesina
function AnnouncementMarqueeForm({
  config,
  onChange,
}: {
  config: AnnouncementMarqueeConfig;
  onChange: (c: AnnouncementMarqueeConfig) => void;
}) {
  const messages = config.messages || [];

  const handleMessageChange = (index: number, val: string) => {
    const updated = [...messages];
    updated[index] = val;
    onChange({ ...config, messages: updated });
  };

  const handleAddMessage = () => {
    onChange({ ...config, messages: [...messages, "Nuevo anuncio destacado"] });
  };

  const handleRemoveMessage = (index: number) => {
    onChange({ ...config, messages: messages.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-3 pt-2 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="font-bold text-muted-foreground block mb-1">
            Velocidad (Segundos)
          </label>
          <input
            type="number"
            min={10}
            max={60}
            value={config.speedSeconds || 22}
            onChange={(e) => onChange({ ...config, speedSeconds: Number(e.target.value) || 22 })}
            className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground"
          />
        </div>
        <div>
          <label className="font-bold text-muted-foreground block mb-1">
            Estilo Visual
          </label>
          <select
            value={config.bgVariant || "primary"}
            onChange={(e) => onChange({ ...config, bgVariant: e.target.value as any })}
            className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground"
          >
            <option value="primary">Primario (Marca)</option>
            <option value="dark">Negro Profundo</option>
            <option value="amber">Dorado / Promoción</option>
            <option value="muted">Gris Tenue</option>
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="font-bold text-foreground">Mensajes de la Marquesina</label>
          <button
            type="button"
            onClick={handleAddMessage}
            className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Agregar</span>
          </button>
        </div>
        <div className="space-y-1.5">
          {messages.map((msg, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <input
                type="text"
                value={msg}
                onChange={(e) => handleMessageChange(idx, e.target.value)}
                placeholder="Texto del anuncio..."
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground"
              />
              <button
                type="button"
                onClick={() => handleRemoveMessage(idx)}
                className="p-1.5 text-muted-foreground hover:text-rose-500 rounded-lg hover:bg-muted cursor-pointer"
                title="Eliminar mensaje"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 2. Hero Slider
function HeroSliderForm({
  config,
  categories,
  onChange,
}: {
  config: HeroSliderConfig;
  categories: Category[];
  onChange: (c: HeroSliderConfig) => void;
}) {
  const slides = config.slides || [];

  const handleUpdateSlide = (index: number, patch: Partial<HeroSliderConfig["slides"][0]>) => {
    const updated = [...slides];
    updated[index] = { ...updated[index], ...patch };
    onChange({ ...config, slides: updated });
  };

  const handleAddSlide = () => {
    const newSlide: HeroSliderConfig["slides"][0] = {
      id: `slide_${Date.now()}`,
      title: "Nuevo Banner Promocional",
      subtitle: "Describe la oferta, categoría o mensaje principal.",
      imageUrl: "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=1600&auto=format&fit=crop&q=80",
      ctaText: "Ver Catálogo",
      ctaLink: "catalog",
      badgeText: "NUEVO",
      textAlignment: "left",
      overlayOpacity: 45,
    };
    onChange({ ...config, slides: [...slides, newSlide] });
  };

  const handleRemoveSlide = (index: number) => {
    onChange({ ...config, slides: slides.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-3 pt-2 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="font-bold text-muted-foreground block mb-1">
            Proporción de Pantalla
          </label>
          <select
            value={config.aspectRatio || "21:9"}
            onChange={(e) => onChange({ ...config, aspectRatio: e.target.value as any })}
            className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground"
          >
            <option value="21:9">Ultra-Panorámico (21:9)</option>
            <option value="16:9">Estándar (16:9)</option>
            <option value="4:3">Compacto (4:3)</option>
          </select>
        </div>
        <div>
          <label className="font-bold text-muted-foreground block mb-1">
            Autoplay (ms, 0 = apagado)
          </label>
          <input
            type="number"
            step={500}
            min={0}
            value={config.autoplayIntervalMs ?? 5000}
            onChange={(e) => onChange({ ...config, autoplayIntervalMs: Number(e.target.value) || 0 })}
            className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="font-bold text-foreground">Diapositivas ({slides.length})</label>
          <button
            type="button"
            onClick={handleAddSlide}
            className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Agregar Banner</span>
          </button>
        </div>

        {slides.map((slide, idx) => (
          <div key={slide.id} className="p-2.5 rounded-xl border border-border bg-muted/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground text-[11px]">Banner #{idx + 1}</span>
              <button
                type="button"
                onClick={() => handleRemoveSlide(idx)}
                className="text-muted-foreground hover:text-rose-500 p-1 cursor-pointer"
                title="Eliminar este banner"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <input
                type="text"
                value={slide.title}
                onChange={(e) => handleUpdateSlide(idx, { title: e.target.value })}
                placeholder="Título del banner"
                className="w-full px-2.5 py-1 rounded-lg border border-border bg-background text-foreground font-bold"
              />
              <input
                type="text"
                value={slide.subtitle}
                onChange={(e) => handleUpdateSlide(idx, { subtitle: e.target.value })}
                placeholder="Subtítulo o descripción breve"
                className="w-full px-2.5 py-1 rounded-lg border border-border bg-background text-foreground"
              />
              <input
                type="text"
                value={slide.imageUrl}
                onChange={(e) => handleUpdateSlide(idx, { imageUrl: e.target.value })}
                placeholder="URL de la imagen del banner (https://...)"
                className="w-full px-2.5 py-1 rounded-lg border border-border bg-background text-foreground font-mono text-[11px]"
              />

              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  value={slide.ctaText || ""}
                  onChange={(e) => handleUpdateSlide(idx, { ctaText: e.target.value })}
                  placeholder="Texto Botón (ej: Ver Ofertas)"
                  className="w-full px-2.5 py-1 rounded-lg border border-border bg-background text-foreground"
                />
                <input
                  type="text"
                  value={slide.badgeText || ""}
                  onChange={(e) => handleUpdateSlide(idx, { badgeText: e.target.value })}
                  placeholder="Badge (ej: 25% OFF)"
                  className="w-full px-2.5 py-1 rounded-lg border border-border bg-background text-foreground uppercase"
                />
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground font-semibold block mb-0.5">
                  Destino del Enlace (Link)
                </label>
                <select
                  value={slide.ctaLink || "catalog"}
                  onChange={(e) => handleUpdateSlide(idx, { ctaLink: e.target.value })}
                  className="w-full px-2.5 py-1 rounded-lg border border-border bg-background text-foreground"
                >
                  <option value="catalog">Ir al Catálogo General</option>
                  {categories.map((c) => (
                    <option key={c.id} value={`category:${c.id}`}>
                      Filtrar Categoría: {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 3. Category Bubbles
function CategoryBubblesForm({
  config,
  onChange,
}: {
  config: CategoryBubblesConfig;
  onChange: (c: CategoryBubblesConfig) => void;
}) {
  return (
    <div className="space-y-3 pt-2 text-xs">
      <div className="flex items-center justify-between p-2 rounded-xl bg-muted/40 border border-border">
        <div>
          <span className="font-bold text-foreground block">Categorías Automáticas</span>
          <span className="text-[11px] text-muted-foreground">
            Sincroniza directamente con las categorías activas del catálogo.
          </span>
        </div>
        <input
          type="checkbox"
          checked={config.useAutoCategories ?? true}
          onChange={(e) => onChange({ ...config, useAutoCategories: e.target.checked })}
          className="w-4 h-4 rounded text-primary cursor-pointer"
        />
      </div>

      <div className="flex items-center justify-between p-2 rounded-xl bg-muted/40 border border-border">
        <div>
          <span className="font-bold text-foreground block">Mostrar Nombres</span>
          <span className="text-[11px] text-muted-foreground">
            Muestra el rótulo de texto debajo de cada burbuja.
          </span>
        </div>
        <input
          type="checkbox"
          checked={config.showLabels ?? true}
          onChange={(e) => onChange({ ...config, showLabels: e.target.checked })}
          className="w-4 h-4 rounded text-primary cursor-pointer"
        />
      </div>

      <div>
        <label className="font-bold text-muted-foreground block mb-1">
          Forma de las Burbujas
        </label>
        <select
          value={config.bubbleShape || "circle"}
          onChange={(e) => onChange({ ...config, bubbleShape: e.target.value as any })}
          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground"
        >
          <option value="circle">Circular (Stories de Instagram)</option>
          <option value="squircle">Cuadrado Redondeado (Squircle)</option>
        </select>
      </div>
    </div>
  );
}

// 4. Flash Sale
function FlashSaleForm({
  config,
  categories,
  onChange,
}: {
  config: FlashSaleConfig;
  categories: Category[];
  onChange: (c: FlashSaleConfig) => void;
}) {
  // Convert ISO string to HTML datetime-local format YYYY-MM-DDTHH:mm
  const toLocalInputValue = (iso: string) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      const tzOffset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    } catch {
      return "";
    }
  };

  const handleDateChange = (val: string) => {
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        onChange({ ...config, endsAt: d.toISOString() });
      }
    } catch {}
  };

  return (
    <div className="space-y-2.5 pt-2 text-xs">
      <div>
        <label className="font-bold text-muted-foreground block mb-1">
          Título de la Oferta
        </label>
        <input
          type="text"
          value={config.title}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground font-bold"
        />
      </div>

      <div>
        <label className="font-bold text-muted-foreground block mb-1">
          Subtítulo o Condiciones
        </label>
        <input
          type="text"
          value={config.subtitle}
          onChange={(e) => onChange({ ...config, subtitle: e.target.value })}
          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="font-bold text-muted-foreground block mb-1">
            Insignia de Descuento
          </label>
          <input
            type="text"
            value={config.discountBadgeText || ""}
            onChange={(e) => onChange({ ...config, discountBadgeText: e.target.value })}
            placeholder="ej: HASTA 40% OFF"
            className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground uppercase"
          />
        </div>
        <div>
          <label className="font-bold text-muted-foreground block mb-1">
            Categoría Enlazada
          </label>
          <select
            value={config.targetCategoryId || ""}
            onChange={(e) => onChange({ ...config, targetCategoryId: e.target.value || undefined })}
            className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground"
          >
            <option value="">Todas las promociones</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="font-bold text-muted-foreground block mb-1">
          Fecha y Hora de Cierre (Fin de Cuenta Regresiva)
        </label>
        <input
          type="datetime-local"
          value={toLocalInputValue(config.endsAt)}
          onChange={(e) => handleDateChange(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground font-mono"
        />
      </div>
    </div>
  );
}

// 5. Featured Rails
function FeaturedRailsForm({
  config,
  categories,
  onChange,
}: {
  config: FeaturedRailsConfig;
  categories: Category[];
  onChange: (c: FeaturedRailsConfig) => void;
}) {
  const rails = config.rails || [];

  const handleUpdateRail = (index: number, patch: Partial<FeaturedRailsConfig["rails"][0]>) => {
    const updated = [...rails];
    updated[index] = { ...updated[index], ...patch };
    onChange({ ...config, rails: updated });
  };

  const handleAddRail = () => {
    const newRail = {
      id: `rail_${Date.now()}`,
      title: "🔥 Nuevas Ofertas",
      subtitle: "Selección especial para ti",
      filterType: "bestsellers" as const,
      maxItems: 8,
    };
    onChange({ ...config, rails: [...rails, newRail] });
  };

  const handleRemoveRail = (index: number) => {
    onChange({ ...config, rails: rails.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-3 pt-2 text-xs">
      <div className="flex items-center justify-between">
        <label className="font-bold text-foreground">Rieles de Productos ({rails.length})</label>
        <button
          type="button"
          onClick={handleAddRail}
          className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>Agregar Riel</span>
        </button>
      </div>

      {rails.map((rail, idx) => (
        <div key={rail.id} className="p-2.5 rounded-xl border border-border bg-muted/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-foreground text-[11px]">Riel #{idx + 1}</span>
            <button
              type="button"
              onClick={() => handleRemoveRail(idx)}
              className="text-muted-foreground hover:text-rose-500 p-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <input
            type="text"
            value={rail.title}
            onChange={(e) => handleUpdateRail(idx, { title: e.target.value })}
            placeholder="Título del riel (ej: 🔥 Los Más Vendidos)"
            className="w-full px-2.5 py-1 rounded-lg border border-border bg-background text-foreground font-bold"
          />
          <input
            type="text"
            value={rail.subtitle || ""}
            onChange={(e) => handleUpdateRail(idx, { subtitle: e.target.value })}
            placeholder="Subtítulo opcional"
            className="w-full px-2.5 py-1 rounded-lg border border-border bg-background text-foreground"
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground font-bold block mb-0.5">
                Tipo de Filtro
              </label>
              <select
                value={rail.filterType}
                onChange={(e) => handleUpdateRail(idx, { filterType: e.target.value as any })}
                className="w-full px-2.5 py-1 rounded-lg border border-border bg-background text-foreground"
              >
                <option value="bestsellers">Más Vendidos / Stock</option>
                <option value="category">Por Categoría</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-bold block mb-0.5">
                Máximo de Productos
              </label>
              <input
                type="number"
                min={4}
                max={20}
                value={rail.maxItems || 8}
                onChange={(e) => handleUpdateRail(idx, { maxItems: Number(e.target.value) || 8 })}
                className="w-full px-2.5 py-1 rounded-lg border border-border bg-background text-foreground"
              />
            </div>
          </div>

          {rail.filterType === "category" && (
            <div>
              <label className="text-[10px] text-muted-foreground font-bold block mb-0.5">
                Seleccionar Categoría
              </label>
              <select
                value={rail.categoryId || ""}
                onChange={(e) => handleUpdateRail(idx, { categoryId: e.target.value })}
                className="w-full px-2.5 py-1 rounded-lg border border-border bg-background text-foreground"
              >
                <option value="">Selecciona una categoría...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// 6. Product Reels
function ProductReelsForm({
  config,
  onChange,
}: {
  config: ProductReelsConfig;
  onChange: (c: ProductReelsConfig) => void;
}) {
  const reels = config.reels || [];

  const handleUpdateReel = (index: number, patch: Partial<ProductReelsConfig["reels"][0]>) => {
    const updated = [...reels];
    updated[index] = { ...updated[index], ...patch };
    onChange({ ...config, reels: updated });
  };

  const handleAddReel = () => {
    const newReel = {
      id: `reel_${Date.now()}`,
      title: "Demostración de Producto",
      videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
      badge: "HOT",
    };
    onChange({ ...config, reels: [...reels, newReel] });
  };

  const handleRemoveReel = (index: number) => {
    onChange({ ...config, reels: reels.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-3 pt-2 text-xs">
      <div className="flex items-center justify-between p-2 rounded-xl bg-muted/40 border border-border">
        <div>
          <span className="font-bold text-foreground block">Reproducción al pasar cursor</span>
          <span className="text-[11px] text-muted-foreground">
            Inicia automáticamente el video al pasar el mouse por encima.
          </span>
        </div>
        <input
          type="checkbox"
          checked={config.autoplayOnHover ?? true}
          onChange={(e) => onChange({ ...config, autoplayOnHover: e.target.checked })}
          className="w-4 h-4 rounded text-primary cursor-pointer"
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="font-bold text-foreground">Videos Cortos ({reels.length})</label>
        <button
          type="button"
          onClick={handleAddReel}
          className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>Agregar Reel</span>
        </button>
      </div>

      {reels.map((reel, idx) => (
        <div key={reel.id} className="p-2.5 rounded-xl border border-border bg-muted/40 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-foreground text-[11px]">Video #{idx + 1}</span>
            <button
              type="button"
              onClick={() => handleRemoveReel(idx)}
              className="text-muted-foreground hover:text-rose-500 p-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            type="text"
            value={reel.title}
            onChange={(e) => handleUpdateReel(idx, { title: e.target.value })}
            placeholder="Título del video"
            className="w-full px-2.5 py-1 rounded-lg border border-border bg-background text-foreground font-bold"
          />
          <input
            type="text"
            value={reel.videoUrl}
            onChange={(e) => handleUpdateReel(idx, { videoUrl: e.target.value })}
            placeholder="URL del video MP4 (https://...)"
            className="w-full px-2.5 py-1 rounded-lg border border-border bg-background text-foreground font-mono text-[11px]"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={reel.posterUrl || ""}
              onChange={(e) => handleUpdateReel(idx, { posterUrl: e.target.value })}
              placeholder="URL Poster (miniatura)"
              className="w-full px-2.5 py-1 rounded-lg border border-border bg-background text-foreground font-mono text-[11px]"
            />
            <input
              type="text"
              value={reel.badge || ""}
              onChange={(e) => handleUpdateReel(idx, { badge: e.target.value })}
              placeholder="Insignia (ej: NUEVO)"
              className="w-full px-2.5 py-1 rounded-lg border border-border bg-background text-foreground uppercase"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// 7. Trust Badges
function TrustBadgesForm({
  config,
  onChange,
}: {
  config: TrustBadgesConfig;
  onChange: (c: TrustBadgesConfig) => void;
}) {
  const badges = config.badges || [];

  const handleUpdateBadge = (index: number, patch: Partial<TrustBadgesConfig["badges"][0]>) => {
    const updated = [...badges];
    updated[index] = { ...updated[index], ...patch };
    onChange({ ...config, badges: updated });
  };

  const handleAddBadge = () => {
    const newBadge: TrustBadgesConfig["badges"][0] = {
      id: `badge_${Date.now()}`,
      icon: "ShieldCheck",
      title: "Garantía Total",
      description: "Compromiso de satisfacción en cada pedido.",
    };
    onChange({ ...config, badges: [...badges, newBadge] });
  };

  const handleRemoveBadge = (index: number) => {
    onChange({ ...config, badges: badges.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-3 pt-2 text-xs">
      <div>
        <label className="font-bold text-muted-foreground block mb-1">
          Columnas en Pantalla Grande
        </label>
        <select
          value={config.columns || 4}
          onChange={(e) => onChange({ ...config, columns: Number(e.target.value) as any })}
          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground"
        >
          <option value={2}>2 Columnas</option>
          <option value={3}>3 Columnas</option>
          <option value={4}>4 Columnas</option>
        </select>
      </div>

      <div className="flex items-center justify-between">
        <label className="font-bold text-foreground">Insignias ({badges.length})</label>
        <button
          type="button"
          onClick={handleAddBadge}
          className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>Agregar Insignia</span>
        </button>
      </div>

      {badges.map((badge, idx) => (
        <div key={badge.id} className="p-2.5 rounded-xl border border-border bg-muted/40 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-foreground text-[11px]">Insignia #{idx + 1}</span>
            <button
              type="button"
              onClick={() => handleRemoveBadge(idx)}
              className="text-muted-foreground hover:text-rose-500 p-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <select
              value={badge.icon}
              onChange={(e) => handleUpdateBadge(idx, { icon: e.target.value as any })}
              className="px-2 py-1 rounded-lg border border-border bg-background text-foreground"
            >
              <option value="Truck">Envío / Camión</option>
              <option value="CreditCard">Tarjeta / Pagos</option>
              <option value="ShieldCheck">Escudo / Seguridad</option>
              <option value="MessageCircle">Mensaje / WhatsApp</option>
              <option value="Clock">Reloj / Horario</option>
              <option value="RefreshCw">Devolución / Giro</option>
              <option value="Award">Medalla / Calidad</option>
            </select>
            <input
              type="text"
              value={badge.title}
              onChange={(e) => handleUpdateBadge(idx, { title: e.target.value })}
              placeholder="Título"
              className="col-span-2 px-2.5 py-1 rounded-lg border border-border bg-background text-foreground font-bold"
            />
          </div>
          <input
            type="text"
            value={badge.description}
            onChange={(e) => handleUpdateBadge(idx, { description: e.target.value })}
            placeholder="Descripción breve"
            className="w-full px-2.5 py-1 rounded-lg border border-border bg-background text-foreground"
          />
        </div>
      ))}
    </div>
  );
}

// 8. Testimonials
function TestimonialsForm({
  config,
  onChange,
}: {
  config: TestimonialsConfig;
  onChange: (c: TestimonialsConfig) => void;
}) {
  const items = config.items || [];

  const handleUpdateItem = (index: number, patch: Partial<TestimonialsConfig["items"][0]>) => {
    const updated = [...items];
    updated[index] = { ...updated[index], ...patch };
    onChange({ ...config, items: updated });
  };

  const handleAddItem = () => {
    const newItem: TestimonialsConfig["items"][0] = {
      id: `rev_${Date.now()}`,
      authorName: "Nombre del Cliente",
      authorLocation: "Cliente Verificado",
      rating: 5,
      comment: "Excelente servicio, la rapidez y atención al cliente superaron mis expectativas.",
      verifiedBuyer: true,
      dateText: "Esta semana",
    };
    onChange({ ...config, items: [...items, newItem] });
  };

  const handleRemoveItem = (index: number) => {
    onChange({ ...config, items: items.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-3 pt-2 text-xs">
      <div>
        <label className="font-bold text-muted-foreground block mb-1">
          Título de la Sección
        </label>
        <input
          type="text"
          value={config.title || ""}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground font-bold"
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="font-bold text-foreground">Reseñas ({items.length})</label>
        <button
          type="button"
          onClick={handleAddItem}
          className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>Agregar Reseña</span>
        </button>
      </div>

      {items.map((item, idx) => (
        <div key={item.id} className="p-2.5 rounded-xl border border-border bg-muted/40 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-foreground text-[11px]">Cliente #{idx + 1}</span>
            <button
              type="button"
              onClick={() => handleRemoveItem(idx)}
              className="text-muted-foreground hover:text-rose-500 p-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={item.authorName}
              onChange={(e) => handleUpdateItem(idx, { authorName: e.target.value })}
              placeholder="Nombre del cliente"
              className="px-2.5 py-1 rounded-lg border border-border bg-background text-foreground font-bold"
            />
            <input
              type="text"
              value={item.authorLocation || ""}
              onChange={(e) => handleUpdateItem(idx, { authorLocation: e.target.value })}
              placeholder="Ciudad o Distintivo"
              className="px-2.5 py-1 rounded-lg border border-border bg-background text-foreground"
            />
          </div>

          <textarea
            rows={2}
            value={item.comment}
            onChange={(e) => handleUpdateItem(idx, { comment: e.target.value })}
            placeholder="Opinión del cliente..."
            className="w-full px-2.5 py-1 rounded-lg border border-border bg-background text-foreground resize-none"
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-muted-foreground text-[11px]">Estrellas:</span>
              <select
                value={item.rating}
                onChange={(e) => handleUpdateItem(idx, { rating: Number(e.target.value) })}
                className="px-2 py-0.5 rounded border border-border bg-background text-foreground"
              >
                <option value={5}>5 Estrellas</option>
                <option value={4}>4 Estrellas</option>
                <option value={3}>3 Estrellas</option>
              </select>
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={item.verifiedBuyer}
                onChange={(e) => handleUpdateItem(idx, { verifiedBuyer: e.target.checked })}
                className="w-3.5 h-3.5 rounded text-primary"
              />
              <span>Comprador Verificado</span>
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}

// 9. Brand Story
function BrandStoryForm({
  config,
  onChange,
}: {
  config: BrandStoryConfig;
  onChange: (c: BrandStoryConfig) => void;
}) {
  return (
    <div className="space-y-2.5 pt-2 text-xs">
      <div>
        <label className="font-bold text-muted-foreground block mb-1">
          Título de la Historia
        </label>
        <input
          type="text"
          value={config.title}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground font-bold"
        />
      </div>

      <div>
        <label className="font-bold text-muted-foreground block mb-1">
          Texto de la Historia / Trayectoria
        </label>
        <textarea
          rows={3}
          value={config.storyContent}
          onChange={(e) => onChange({ ...config, storyContent: e.target.value })}
          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground resize-none"
        />
      </div>

      <div>
        <label className="font-bold text-muted-foreground block mb-1">
          URL de la Imagen de la Tienda / Equipo
        </label>
        <input
          type="text"
          value={config.imageUrl}
          onChange={(e) => onChange({ ...config, imageUrl: e.target.value })}
          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground font-mono text-[11px]"
        />
      </div>

      <div>
        <label className="font-bold text-muted-foreground block mb-1">
          Horarios de Atención
        </label>
        <input
          type="text"
          value={config.businessHours || ""}
          onChange={(e) => onChange({ ...config, businessHours: e.target.value })}
          placeholder="ej: Lunes a Sábado: 8:00 AM - 7:00 PM"
          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground"
        />
      </div>

      <div>
        <label className="font-bold text-muted-foreground block mb-1">
          Enlace a Google Maps
        </label>
        <input
          type="text"
          value={config.googleMapsUrl || ""}
          onChange={(e) => onChange({ ...config, googleMapsUrl: e.target.value })}
          placeholder="https://maps.google.com/..."
          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground font-mono text-[11px]"
        />
      </div>

      <div className="flex items-center justify-between p-2 rounded-xl bg-muted/40 border border-border">
        <div>
          <span className="font-bold text-foreground block">Mostrar Dirección de la Sucursal</span>
          <span className="text-[11px] text-muted-foreground">
            Incluye la dirección física de la sede seleccionada.
          </span>
        </div>
        <input
          type="checkbox"
          checked={config.showBranchAddress ?? true}
          onChange={(e) => onChange({ ...config, showBranchAddress: e.target.checked })}
          className="w-4 h-4 rounded text-primary cursor-pointer"
        />
      </div>
    </div>
  );
}

// 10. FAQ Accordion
function FaqAccordionForm({
  config,
  onChange,
}: {
  config: FaqAccordionConfig;
  onChange: (c: FaqAccordionConfig) => void;
}) {
  const items = config.items || [];

  const handleUpdateItem = (index: number, patch: Partial<FaqAccordionConfig["items"][0]>) => {
    const updated = [...items];
    updated[index] = { ...updated[index], ...patch };
    onChange({ ...config, items: updated });
  };

  const handleAddItem = () => {
    const newItem = {
      id: `faq_${Date.now()}`,
      question: "¿Nueva pregunta frecuente?",
      answer: "Escribe la respuesta detallada y clara aquí.",
    };
    onChange({ ...config, items: [...items, newItem] });
  };

  const handleRemoveItem = (index: number) => {
    onChange({ ...config, items: items.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-3 pt-2 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="font-bold text-muted-foreground block mb-1">
            Título
          </label>
          <input
            type="text"
            value={config.title || ""}
            onChange={(e) => onChange({ ...config, title: e.target.value })}
            className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground font-bold"
          />
        </div>
        <div>
          <label className="font-bold text-muted-foreground block mb-1">
            Subtítulo
          </label>
          <input
            type="text"
            value={config.subtitle || ""}
            onChange={(e) => onChange({ ...config, subtitle: e.target.value })}
            className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="font-bold text-foreground">Preguntas y Respuestas ({items.length})</label>
        <button
          type="button"
          onClick={handleAddItem}
          className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>Agregar Pregunta</span>
        </button>
      </div>

      {items.map((item, idx) => (
        <div key={item.id} className="p-2.5 rounded-xl border border-border bg-muted/40 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-foreground text-[11px]">Pregunta #{idx + 1}</span>
            <button
              type="button"
              onClick={() => handleRemoveItem(idx)}
              className="text-muted-foreground hover:text-rose-500 p-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <input
            type="text"
            value={item.question}
            onChange={(e) => handleUpdateItem(idx, { question: e.target.value })}
            placeholder="¿Pregunta frecuente?"
            className="w-full px-2.5 py-1 rounded-lg border border-border bg-background text-foreground font-bold"
          />
          <textarea
            rows={2}
            value={item.answer}
            onChange={(e) => handleUpdateItem(idx, { answer: e.target.value })}
            placeholder="Respuesta explicativa..."
            className="w-full px-2.5 py-1 rounded-lg border border-border bg-background text-foreground resize-none"
          />
        </div>
      ))}
    </div>
  );
}
