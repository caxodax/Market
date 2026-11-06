"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  TenantSettings,
  ExchangeRate,
  Store,
  UserProfile,
} from "@marketos/types";
import {
  Menu,
  X,
  ExternalLink,
  Landmark,
  RefreshCw,
  Store as StoreIcon,
  ChevronDown,
} from "lucide-react";
import { syncBcvRateAction } from "@/app/admin/actions";
import { toast } from "sonner";

interface AdminHeaderProps {
  settings: TenantSettings;
  exchangeRate: ExchangeRate;
  stores: Store[];
  currentUser: UserProfile;
  currentStoreId?: string;
  onOpenMobileMenu?: () => void;
}

const SECTION_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/admin/payments": {
    title: "Validación de Pagos",
    subtitle: "Conciliación de transferencias, Pago Móvil y Zelle",
  },
  "/admin/orders": {
    title: "Despacho y Pedidos",
    subtitle: "Control de estados, preparación y rutas de entrega",
  },
  "/admin/inventory": {
    title: "Inventario en Tienda",
    subtitle: "Catálogo de productos, existencias y precios",
  },
  "/admin/pos": {
    title: "Punto de Venta (POS)",
    subtitle: "Turnos de caja y ventas presenciales rápidas",
  },
  "/admin/delivery": {
    title: "Delivery y Repartidores",
    subtitle: "Zonas de cobertura, tarifas y motorizados",
  },
  "/admin/rates": {
    title: "Tasas y Divisas (BCV)",
    subtitle: "Monitor oficial BCV y fijación de tasas comerciales",
  },
  "/admin/invoicing": {
    title: "Facturación Fiscal SENIAT",
    subtitle: "Emisión de facturas electrónicas y notas fiscales",
  },
  "/admin/purchasing": {
    title: "Compras & Retenciones",
    subtitle: "Facturas de compras y comprobantes de retención IVA SPE",
  },
  "/admin/accounting": {
    title: "Contabilidad & Libros",
    subtitle: "Plan de cuentas NIIF y balance de sumas y saldos",
  },
  "/admin/craft": {
    title: "Taller Gráfico & Sublimación",
    subtitle: "Costeo por técnica, mermas y cotizaciones WhatsApp",
  },
  "/admin/food-service": {
    title: "Food Service & Cocina",
    subtitle: "Insumos, recetas, escandallo y modificadores",
  },
  "/admin/storefront-studio": {
    title: "Vitrina Visual Pro & Studio",
    subtitle: "Banners, sliders y personalización de marca",
  },
  "/admin/mto-cpq": {
    title: "Cotizador MTO / Taller",
    subtitle: "Cálculo CPQ por metros cuadrados y anticipos",
  },
  "/admin/coupons": {
    title: "Cupones de Descuento",
    subtitle: "Promociones temporales y códigos promocionales",
  },
  "/admin/push": {
    title: "Notificaciones Web Push",
    subtitle: "Difusiones masivas de marketing a clientes",
  },
  "/admin/reports": {
    title: "Reportes & Ventas",
    subtitle: "Métricas financieras, ingresos y libro contable",
  },
  "/admin/stores": {
    title: "Sucursales & Sedes",
    subtitle: "Administración de sedes físicas y puntos de retiro",
  },
  "/admin/staff": {
    title: "Equipo & Colaboradores",
    subtitle: "Gestión de personal y roles de acceso",
  },
  "/admin/audit": {
    title: "Auditoría & Logs",
    subtitle: "Trazabilidad inmutable de operaciones del sistema",
  },
  "/admin/settings": {
    title: "Configuración General",
    subtitle: "Datos de empresa, métodos de pago y marca",
  },
  "/admin/plugins": {
    title: "Módulos & Ecosistema",
    subtitle: "Activación de plugins y extensiones de tienda",
  },
};

export function AdminHeader({
  settings,
  exchangeRate,
  stores,
  currentUser,
  currentStoreId,
  onOpenMobileMenu,
}: AdminHeaderProps) {
  const pathname = usePathname();
  const [syncingRate, setSyncingRate] = useState(false);

  // Match closest route
  const sectionKey = Object.keys(SECTION_TITLES).find(
    (k) => pathname === k || pathname.startsWith(k + "/")
  ) || "/admin/payments";
  const section = SECTION_TITLES[sectionKey] || {
    title: "Panel de Control",
    subtitle: "Administración general de tienda",
  };

  const handleSyncRate = async () => {
    try {
      setSyncingRate(true);
      const res = await syncBcvRateAction(settings.tenant_id);
      if (res?.success) {
        toast.success(`Tasa BCV sincronizada a Bs. ${res.rate?.value.toFixed(2)}`);
      } else {
        toast.error(res?.error || "Error al sincronizar tasa BCV");
      }
    } catch {
      toast.error("Error de comunicación al actualizar la tasa");
    } finally {
      setSyncingRate(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 bg-background/85 backdrop-blur-md border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
      {/* Left: Mobile Menu Trigger + View Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
          title="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-black text-foreground tracking-tight truncate leading-tight">
            {section.title}
          </h1>
          <p className="hidden sm:block text-xs text-muted-foreground truncate font-medium">
            {section.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Quick BCV Rate + Store Selector + Storefront Link */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Quick BCV Rate Indicator */}
        {exchangeRate?.value && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-mono text-xs font-bold">
            <Landmark className="w-3.5 h-3.5 shrink-0" />
            <span>Bs. {exchangeRate.value.toFixed(2)}</span>
            <button
              type="button"
              onClick={handleSyncRate}
              disabled={syncingRate}
              className="ml-1 p-0.5 rounded hover:bg-emerald-500/20 transition-colors cursor-pointer"
              title="Sincronizar tasa oficial con BCV"
            >
              <RefreshCw className={`w-3 h-3 ${syncingRate ? "animate-spin" : ""}`} />
            </button>
          </div>
        )}

        {/* Multi-Store Selector (if more than 1 store) */}
        {stores.length > 1 && (
          <div className="hidden md:flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-bold text-foreground">
            <StoreIcon className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="truncate max-w-[120px]">
              {stores.find((s) => s.id === currentStoreId)?.name || "Todas las sedes"}
            </span>
          </div>
        )}

        {/* Storefront Link */}
        <Link
          href="/"
          target="_blank"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-extrabold text-foreground transition-all cursor-pointer shadow-2xs active:scale-95"
          title="Ver vitrina pública"
        >
          <ExternalLink className="w-3.5 h-3.5 text-primary" />
          <span className="hidden sm:inline">Vitrina</span>
        </Link>
      </div>
    </header>
  );
}
