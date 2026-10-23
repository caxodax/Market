"use client";

import React, { useState, useEffect } from "react";
import { TenantWithDetails, TenantModule, TenantModuleId } from "@marketos/types";
import {
  getTenantModulesAction,
  setTenantModuleStatusAction,
} from "../app/actions";
import {
  Puzzle,
  Utensils,
  ScanBarcode,
  Landmark,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Info,
  Search,
  Power,
  PowerOff,
  ChevronLeft,
  ChevronRight,
  Filter,
  Truck,
  Ticket,
  Shirt,
  Globe,
  MessageCircle,
  Sliders,
  LayoutTemplate,
  Eye,
  Monitor,
} from "lucide-react";
import { PluginDetailModal } from "./plugin-detail-modal";

interface TenantPluginsModalProps {
  tenant: TenantWithDetails;
  isOpen: boolean;
  onClose: () => void;
  onModulesUpdated?: () => void;
  isSuperAdmin?: boolean;
  supportPhone?: string;
}

export interface PluginMetadata {
  id: TenantModuleId;
  name: string;
  badge: string;
  category:
    | "Restauración"
    | "Comercio Minorista"
    | "Operaciones & Logística"
    | "Marketing & Ventas"
    | "Finanzas Locales"
    | "Fabricación & Personalización";
  categoryShort: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  themeColor: "amber" | "blue" | "emerald" | "purple" | "indigo";
  targetAudience?: string;
}

export const AVAILABLE_PLUGINS: PluginMetadata[] = [
  {
    id: "food_service",
    name: "Gastronomía, Fast Food & Restaurantes",
    badge: "v1.0.0 • Cocina & Menú",
    category: "Restauración",
    categoryShort: "Restauración",
    description:
      "Diseñado para locales de comida rápida, hamburgueserías, pizzerías y restaurantes. Añade control de insumos (BOM), escandallo de costos y personalización interactiva de salsas y extras en el catálogo público.",
    icon: <Utensils className="w-5 h-5 text-amber-500" />,
    features: [
      "Insumos de Cocina: Control de inventario en gramos, mililitros y unidades",
      "Recetas & Escandallo: Fichas técnicas, costo unitario y margen bruto proyectado",
      "Descarte en Tiempo Real: Reducción automática de existencias al validar pedidos",
      "Modal de Salsas & Extras: Personalización interactiva de modificadores para el cliente",
    ],
    targetAudience:
      "Restaurantes, hamburgueserías, pizzerías, locales de sushi, reposterías y cualquier negocio gastronómico que elabore productos con ingredientes fraccionados.",
    themeColor: "amber",
  },
  {
    id: "barcode_retail",
    name: "Retail, Supermercados & Bodegones",
    badge: "v1.0.0 • Punto de Venta",
    category: "Comercio Minorista",
    categoryShort: "Retail",
    description:
      "Optimizado para supermercados, minimarkets y bodegones de alta rotación con soporte de códigos de barra estándar (EAN-13, UPC) y venta por unidad física.",
    icon: <ScanBarcode className="w-5 h-5 text-blue-500" />,
    features: [
      "Lectura rápida de códigos de barra estándar (EAN-13, UPC)",
      "Control de existencias por empaque, bulto y unidad sellada",
      "Gestión de pasillos, estantes y reposición masiva de mercancía",
      "Búsqueda instantánea de productos por escaneo de código",
    ],
    targetAudience:
      "Supermercados, minimarkets, bodegones, licorerías, farmacias y ferreterías con productos empacados y atención rápida en caja.",
    themeColor: "blue",
  },
  {
    id: "clothing_variants",
    name: "Moda, Calzado & Indumentaria",
    badge: "v1.0.0 • Matriz de Variantes",
    category: "Comercio Minorista",
    categoryShort: "Moda & Calzado",
    description:
      "Especial para tiendas de ropa, calzado y accesorios. Permite gestionar matrices bidimensionales de tallas, colores y existencias totalmente independientes.",
    icon: <Shirt className="w-5 h-5 text-indigo-500" />,
    features: [
      "Matriz de tallas y colores independientes por producto",
      "Control de inventario individual por cada combinación (SKU)",
      "Muestrarios de color y selector visual de tallas en el catálogo PWA",
      "Filtros de catálogo por talla disponible y disponibilidad en tiempo real",
    ],
    targetAudience:
      "Boutiques de moda, zapaterías, tiendas deportivas, confección y accesorios que manejen tallas (S, M, L, XL), números de calzado y variedad de colores.",
    themeColor: "indigo",
  },
  {
    id: "delivery_fleet",
    name: "Delivery Propio & Flota de Repartidores",
    badge: "v1.0.0 • Logística Avanzada",
    category: "Operaciones & Logística",
    categoryShort: "Delivery & Rutas",
    description:
      "Gestiona rutas de entrega a domicilio, motorizados propios, asignación de pedidos en tiempo real y tarifas dinámicas configuradas por zona geográfica.",
    icon: <Truck className="w-5 h-5 text-blue-500" />,
    features: [
      "Zonas de reparto personalizadas con tarifas de delivery diferenciadas",
      "Gestión de motorizados y repartidores activos con datos de contacto",
      "Asignación de despachos y tracking de estado en ruta",
      "Opción de entrega a domicilio o retiro en sede en el checkout del cliente",
    ],
    targetAudience:
      "Comercios con reparto a domicilio propio, restaurantes con motorizados internos, farmacias o floristerías que requieran control de rutas y zonas de entrega.",
    themeColor: "blue",
  },
  {
    id: "promotions_coupons",
    name: "Marketing, Cupones & Promociones",
    badge: "v1.0.0 • Conversión & Ventas",
    category: "Marketing & Ventas",
    categoryShort: "Marketing",
    description:
      "Herramientas profesionales de fidelización y conversión. Diseña cupones de descuento porcentuales o de monto fijo, con límites de uso y fechas de caducidad.",
    icon: <Ticket className="w-5 h-5 text-purple-500" />,
    features: [
      "Cupones de descuento en moneda base ($) o porcentaje (%)",
      "Límites de uso por cliente, uso global y fechas de vigencia programadas",
      "Monto mínimo de compra condicional para aplicar el descuento",
      "Canje y validación automática de cupones directamente en el checkout",
    ],
    targetAudience:
      "Cualquier tienda que busque incentivar compras recurrentes, lanzar promociones estacionales, premiar clientes o colaborar con campañas de influencers.",
    themeColor: "purple",
  },
  {
    id: "local_venezuela",
    name: "Localización Oficial Venezuela",
    badge: "v1.0.0 • Fiscal & Bancario",
    category: "Finanzas Locales",
    categoryShort: "Fiscal / BCV",
    description:
      "Integración de pasarelas bancarias locales venezolanas, monitor automático de tasa oficial BCV en tiempo real y facturación fiscal con cálculo legal de IGTF.",
    icon: <Landmark className="w-5 h-5 text-emerald-500" />,
    features: [
      "Sincronización automatizada con la tasa oficial del Banco Central de Venezuela (BCV)",
      "Módulo de validación de Pago Móvil y cuentas bancarias locales",
      "Doble display de precios en Dólares (USD) y Bolívares (VES)",
      "Cálculo legal de IGTF (3%) y comprobantes de retención fiscal",
    ],
    targetAudience:
      "Comercios radicados en Venezuela que cobran en Bolívares (Pago Móvil, transferencias), requieren tasa oficial del BCV en tiempo real y facturación con IGTF.",
    themeColor: "emerald",
  },
  {
    id: "local_colombia",
    name: "Localización Oficial Colombia",
    badge: "v1.0.0 • Finanzas & Pasarelas",
    category: "Finanzas Locales",
    categoryShort: "Colombia / TRM",
    description:
      "Soporte integral para comercios en Colombia. Sincronización con la TRM oficial, precios en Pesos Colombianos (COP) y pagos vía Nequi, Daviplata y PSE.",
    icon: <Landmark className="w-5 h-5 text-emerald-500" />,
    features: [
      "Sincronización de TRM oficial del Banco de la República",
      "Display de precios y cobro nativo en Pesos Colombianos (COP)",
      "Recepción y comprobantes de pago para Nequi, Daviplata y PSE",
      "Campos de identificación fiscal DIAN (Cédula de Ciudadanía, NIT)",
    ],
    targetAudience:
      "Comercios operando en Colombia que facturan en Pesos Colombianos (COP) y reciben transferencias bancarias y billeteras móviles locales.",
    themeColor: "emerald",
  },
  {
    id: "local_global",
    name: "Localización Global & Pagos en Dólares",
    badge: "v1.0.0 • Tarjetas & Stripe",
    category: "Finanzas Locales",
    categoryShort: "Global / USD",
    description:
      "Para comercios internacionales o transfronterizos que operan puramente en Dólares (USD) con pasarelas de tarjetas de crédito/débito y transferencias internacionales.",
    icon: <Globe className="w-5 h-5 text-indigo-500" />,
    features: [
      "Operación pura en USD sin conversiones cambiarias locales",
      "Pasarela de tarjetas de crédito y débito internacionales",
      "Integración con PayPal y transferencias internacionales",
      "Facturación estándar internacional sin recargos locales",
    ],
    targetAudience:
      "Negocios internacionales, exportadores, dropshipping o ventas transfronterizas que operan puramente en Dólares (USD) con pasarelas globales.",
    themeColor: "indigo",
  },
  {
    id: "mto_cpq",
    name: "Make-to-Order & CPQ (Personalización & Cotizador)",
    badge: "v1.0.0 • Cost-Plus & Taller",
    category: "Fabricación & Personalización",
    categoryShort: "MTO & CPQ",
    description:
      "Motor universal de cotización y costeo para fabricación bajo pedido (sublimación, imprenta textil, cortinas, cristalería, letreros). Incluye matrices por área/longitud/volumen, auditoría de margen neto y hojas de taller sin datos financieros.",
    icon: <Sliders className="w-5 h-5 text-indigo-500" />,
    features: [
      "Matriz Universal: Dimensiones por área (m²), metros lineales (m) o unidad personalizada",
      "Cost-Plus Real: Insumos base, factor de merma (%), mano de obra y horas de máquina",
      "Vista Dual: Margen neto y ganancia privada para el dueño; precio limpio para el cliente",
      "Ficha de Taller & Anticipos: Hoja técnica sin precios y control de hitos (50% anticipo)",
    ],
    targetAudience:
      "Sublimación, imprentas, talleres textiles, carpinterías, cristalerías, letreros y fabricantes bajo pedido que necesitan costeo Cost-Plus y hojas de taller.",
    themeColor: "indigo",
  },
  {
    id: "storefront_pro",
    name: "Vitrina Visual Pro & Layout Studio",
    badge: "v1.0.0 • 10 Bloques Modulares",
    category: "Marketing & Ventas",
    categoryShort: "Vitrina Pro",
    description:
      "Transforma tu tienda con un maquetador modular de 10 bloques activables: Sliders dinámicos, Stories de categorías, rieles curados, testimonios con estrellas, ticker animado, contador regresivo flash, reels de video y acordeón FAQ.",
    icon: <LayoutTemplate className="w-5 h-5 text-rose-500" />,
    features: [
      "10 Bloques Modulares: Sliders, Banners, Stories, Rieles de Más Vendidos, FAQ y Reseñas",
      "Prueba Social Real: Testimonios con 5 estrellas, avatares y check de comprador verificado",
      "Venta Flash & FOMO: Contador regresivo en tiempo real con horas, minutos y segundos",
      "100% Personalizable: Activa, desactiva y reordena cada bloque desde el panel de control",
    ],
    targetAudience:
      "Comercios que buscan destacar visualmente con vitrinas modernas: sliders promocionales, stories estilo Instagram, reseñas con estrellas y contadores flash.",
    themeColor: "purple",
  },
  {
    id: "pos_registers",
    name: "Multi-Caja & Turnos POS",
    badge: "v1.0.0 • Punto de Venta & Arqueo",
    category: "Operaciones & Logística",
    categoryShort: "Multi-Caja POS",
    description:
      "Gestiona múltiples cajas físicas con cajeros autenticados por PIN, apertura y cierre de turno con arqueo (Cierre Z), registro inmutable en base de datos y ticket térmico 80mm imprimible.",
    icon: <Monitor className="w-5 h-5 text-emerald-500" />,
    features: [
      "Múltiples terminales físicas + Caja Virtual/Web separada",
      "Login con PIN numérico de 4 a 6 dígitos por cajero",
      "Apertura de turno con fondo inicial y control de efectivo",
      "Cierre X (corte parcial) y Cierre Z (arqueo definitivo e inmutable)",
      "Ticket de arqueo térmico de 80mm con firma de cajero",
      "Entradas y salidas manuales de caja con justificación",
      "Validación de stock atómica para prevenir ventas concurrentes",
    ],
    targetAudience:
      "Supermercados, abastos, farmacias y comercios retail con uno o más cajeros físicos y ventas online simultáneas.",
    themeColor: "emerald",
  },
];

const ITEMS_PER_PAGE = 6;

export function TenantPluginsModal({
  tenant,
  isOpen,
  onClose,
  onModulesUpdated,
  isSuperAdmin = false,
  supportPhone,
}: TenantPluginsModalProps) {
  const [modules, setModules] = useState<TenantModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<TenantModuleId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedDetailPlugin, setSelectedDetailPlugin] = useState<PluginMetadata | null>(null);

  // Search & Filter & Pagination states
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch tenant modules
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getTenantModulesAction(tenant.id);
        if (isMounted) {
          if (res.success && res.modules) {
            setModules(res.modules);
          } else {
            setError(res.error || "No se pudieron obtener los módulos.");
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || "Error al conectar con la base de datos.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [isOpen, tenant.id]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, statusFilter]);

  if (!isOpen) return null;

  const isModuleActive = (moduleId: TenantModuleId): boolean => {
    const mod = modules.find((m) => m.module_id === moduleId);
    return mod ? mod.is_active : false;
  };

  const handleToggleModule = async (moduleId: TenantModuleId) => {
    if (!isSuperAdmin) {
      setError("Solo el Super Administrador de Plataforma puede activar o desactivar plugins.");
      return;
    }
    const currentEnabled = isModuleActive(moduleId);
    const nextEnabled = !currentEnabled;

    setUpdatingId(moduleId);
    setError(null);
    setSuccessMessage(null);

    // Optimistic update
    setModules((prev) => {
      const exists = prev.some((m) => m.module_id === moduleId);
      if (exists) {
        return prev.map((m) =>
          m.module_id === moduleId ? { ...m, is_active: nextEnabled, updated_at: new Date().toISOString() } : m
        );
      } else {
        return [
          ...prev,
          {
            id: `temp-${Date.now()}`,
            tenant_id: tenant.id,
            module_id: moduleId,
            is_active: nextEnabled,
            installed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];
      }
    });

    try {
      const res = await setTenantModuleStatusAction(tenant.id, moduleId, nextEnabled);
      if (res.success) {
        const plugin = AVAILABLE_PLUGINS.find((p) => p.id === moduleId);
        setSuccessMessage(
          `Módulo "${plugin?.name || moduleId}" ${nextEnabled ? "activado" : "desactivado"} exitosamente.`
        );
        if (onModulesUpdated) onModulesUpdated();
      } else {
        // Revert
        setModules((prev) =>
          prev.map((m) =>
            m.module_id === moduleId ? { ...m, is_active: currentEnabled } : m
          )
        );
        setError(res.error || "No se pudo actualizar el estado del módulo.");
      }
    } catch (err: any) {
      // Revert
      setModules((prev) =>
        prev.map((m) =>
          m.module_id === moduleId ? { ...m, is_active: currentEnabled } : m
        )
      );
      setError(err.message || "Error inesperado al guardar cambios.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Filtered plugins
  const filteredPlugins = AVAILABLE_PLUGINS.filter((plugin) => {
    const isActive = isModuleActive(plugin.id);

    // Category filter
    if (categoryFilter !== "ALL" && plugin.category !== categoryFilter) {
      return false;
    }

    // Status filter
    if (statusFilter === "ACTIVE" && !isActive) return false;
    if (statusFilter === "INACTIVE" && isActive) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = plugin.name.toLowerCase().includes(q);
      const matchDesc = plugin.description.toLowerCase().includes(q);
      const matchCategory = plugin.category.toLowerCase().includes(q);
      const matchFeatures = plugin.features.some((f) => f.toLowerCase().includes(q));
      if (!matchName && !matchDesc && !matchCategory && !matchFeatures) {
        return false;
      }
    }

    return true;
  });

  // Pagination calculation
  const totalItems = filteredPlugins.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const paginatedPlugins = filteredPlugins.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const activeCount = AVAILABLE_PLUGINS.filter((p) => isModuleActive(p.id)).length;
  const inactiveCount = AVAILABLE_PLUGINS.length - activeCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="bg-card w-full max-w-2xl sm:max-w-3xl rounded-2xl border border-border shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/20 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 border border-purple-500/20 flex items-center justify-center font-bold shrink-0">
              <Puzzle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black text-foreground truncate">
                  {isSuperAdmin ? "Gestión de Plugins & Módulos" : "Catálogo de Plugins & Extensiones"}
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 px-2.5 py-0.5 rounded-full border border-purple-500/20 whitespace-nowrap">
                  {activeCount} de {AVAILABLE_PLUGINS.length} activos
                </span>
                {!isSuperAdmin && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 px-2.5 py-0.5 rounded-full border border-amber-500/20 whitespace-nowrap">
                    Modo Consulta & Cotización
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                Comercio: <strong className="text-foreground">{tenant.name}</strong> ({tenant.slug})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0 ml-2"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="px-4 py-2.5 bg-muted/40 border-b border-border/60 flex items-start gap-2.5 text-xs text-muted-foreground shrink-0">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            {isSuperAdmin ? (
              <>
                Como <strong>Super Admin</strong>, puedes encender o apagar plugins según el giro comercial de cada cliente. La tienda cargará dinámicamente sus paneles de control sin afectar a otros comercios.
              </>
            ) : (
              <>
                Explora el catálogo de módulos disponibles para tu negocio. Para habilitar o cotizar extensiones en tu tienda, solicita la activación directamente a la Administración de Plataforma.
              </>
            )}
          </p>
        </div>

        {/* Search & Filters Bar (100% Mobile Responsive, No Horizontal Scroll) */}
        <div className="p-3.5 sm:p-4 border-b border-border/70 bg-card space-y-3 shrink-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar plugin por nombre, función o categoría..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-8 rounded-xl border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status pills - Symmetric 3-column grid on mobile */}
            <div className="grid grid-cols-3 sm:flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/60">
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all text-center cursor-pointer ${
                  statusFilter === "ALL"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Todos ({AVAILABLE_PLUGINS.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("ACTIVE")}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all text-center cursor-pointer ${
                  statusFilter === "ACTIVE"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Activos ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("INACTIVE")}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all text-center cursor-pointer ${
                  statusFilter === "INACTIVE"
                    ? "bg-background text-foreground shadow-xs font-black"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Inactivos ({inactiveCount})
              </button>
            </div>
          </div>

          {/* Category filter chips - Wrapped (Zero sideways scroll) */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs pt-0.5">
            <span className="text-muted-foreground font-semibold flex items-center gap-1 text-[11px] mr-1 shrink-0">
              <Filter className="w-3 h-3" /> Categoría:
            </span>
            {[
              { id: "ALL", label: "Todas" },
              { id: "Restauración", label: "Restauración & Menú" },
              { id: "Comercio Minorista", label: "Retail & Moda" },
              { id: "Operaciones & Logística", label: "Delivery & Logística" },
              { id: "Marketing & Ventas", label: "Marketing & Cupones" },
              { id: "Finanzas Locales", label: "Finanzas & Fiscal" },
              { id: "Fabricación & Personalización", label: "Fabricación & MTO" },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  categoryFilter === cat.id
                    ? "bg-primary/10 text-primary border border-primary/30 font-bold"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content list */}
        <div className="p-3.5 sm:p-4 overflow-y-auto space-y-3.5 flex-1 bg-muted/10 overflow-x-hidden">
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs font-semibold">Consultando módulos en base de datos...</p>
            </div>
          ) : paginatedPlugins.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-border/80 bg-background/50 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">
                  No se encontraron plugins
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  No hay plugins que coincidan con los filtros aplicados.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setCategoryFilter("ALL");
                  setStatusFilter("ALL");
                }}
                className="text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                Restablecer todos los filtros
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {paginatedPlugins.map((plugin) => {
                const isActive = isModuleActive(plugin.id);
                const isBusy = updatingId === plugin.id;

                return (
                  <div
                    key={plugin.id}
                    onClick={() => setSelectedDetailPlugin(plugin)}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer group ${
                      isActive
                        ? "bg-card border-emerald-500/40 shadow-xs hover:border-emerald-500/80 ring-1 ring-emerald-500/20"
                        : "bg-card border-border hover:border-primary/50 hover:shadow-xs"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                      {/* Left: Plugin Essential Info (Compact, Clean, No Ellipsis) */}
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-muted/60 border border-border/80 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          {plugin.icon}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-black text-sm text-foreground group-hover:text-primary transition-colors">
                              {plugin.name}
                            </h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground shrink-0">
                              {plugin.badge}
                            </span>
                            <span className="text-[10px] font-semibold text-muted-foreground border border-border/70 px-2 py-0.5 rounded-md shrink-0">
                              {plugin.category}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-primary font-semibold group-hover:underline">
                            <Info className="w-3.5 h-3.5 shrink-0" />
                            <span>Ver ficha completa & capacidades sin recorte →</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Status & Action (Stopping propagation to keep card clickable) */}
                      <div
                        className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Status Badge */}
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Habilitado</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border/60">
                            <PowerOff className="w-3 h-3 opacity-60 shrink-0" />
                            <span>Desactivado</span>
                          </span>
                        )}

                        {/* Symmetrical Action Button */}
                        {isSuperAdmin ? (
                          isActive ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleToggleModule(plugin.id)}
                              className="h-8 px-3 rounded-xl border border-destructive/40 bg-destructive/5 hover:bg-destructive/15 text-destructive font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 active:scale-95 shadow-2xs"
                              title="Desactivar plugin para esta tienda"
                            >
                              {isBusy ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <PowerOff className="w-3 h-3" />
                              )}
                              <span>Desactivar</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleToggleModule(plugin.id)}
                              className="h-8 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 active:scale-95 shadow-sm hover:shadow"
                              title="Activar e instalar plugin para esta tienda"
                            >
                              {isBusy ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Power className="w-3 h-3" />
                              )}
                              <span>Activar Módulo</span>
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedDetailPlugin(plugin)}
                            className="h-8 px-3 rounded-xl border border-border hover:bg-muted text-foreground font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>Ver Ficha</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination & Footer */}
        <div className="p-3.5 sm:p-4 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Pagination controls */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground w-full sm:w-auto justify-between sm:justify-start">
            <span>
              Mostrando{" "}
              <strong className="text-foreground">
                {totalItems === 0
                  ? 0
                  : `${(currentPage - 1) * ITEMS_PER_PAGE + 1}-${Math.min(
                      currentPage * ITEMS_PER_PAGE,
                      totalItems
                    )}`}
              </strong>{" "}
              de <strong className="text-foreground">{totalItems}</strong> plugins
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1 ml-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 text-xs font-semibold">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Página siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-xl bg-primary text-primary-foreground font-black text-xs hover:bg-primary/90 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              Listo
            </button>
          </div>
        </div>
      </div>

      {/* Full Plugin Detail Modal (Progressive Disclosure - Uncut Details) */}
      {selectedDetailPlugin && (
        <PluginDetailModal
          plugin={selectedDetailPlugin}
          isOpen={Boolean(selectedDetailPlugin)}
          onClose={() => setSelectedDetailPlugin(null)}
          isActive={isModuleActive(selectedDetailPlugin.id)}
          isSuperAdmin={isSuperAdmin}
          isBusy={updatingId === selectedDetailPlugin.id}
          onToggleStatus={(id) => handleToggleModule(id)}
          supportPhone={supportPhone}
          tenantName={tenant.name}
          tenantId={tenant.id}
        />
      )}
    </div>
  );
}
