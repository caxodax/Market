# MarketOS — Arquitectura Modular: Core y Sistema de Plugins de la A a la Z

> **Versión**: 3.0.0-production  
> **Patrón**: Clean Architecture + Arquitectura Hexagonal (Puertos y Adaptadores) + Modelo Modular Odoo / Shopify Apps  
> **Ubicación de Plugins**: `packages/plugins/*`  
> **Contrato de Tipos**: [`packages/types/src/modules.ts`](file:///home/lmontes/Documentos/Telegram/Market/packages/types/src/modules.ts) y [`packages/types/src/ports.ts`](file:///home/lmontes/Documentos/Telegram/Market/packages/types/src/ports.ts)  

---

## 1. Principio Fundamental de Diseño: Core Agnóstico y Plugins Autocontenidos

MarketOS está concebido para operar en múltiples industrias y geografías **sin duplicar código, sin ramas divergentes de Git y manteniendo un rendimiento extremo**:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           MARKETOS CORE (Agnóstico)                             │
│   Auth • Carrito • Pedidos • Tracking QR • Sedes • Storage R2 • Puertos Puros   │
└────────────────────────┬───────────────────────────────┬────────────────────────┘
                         │                               │
        ┌────────────────┴───────────────┐   ┌───────────┴────────────────┐
        │    PLUGINS DE LOCALIZACIÓN     │   │     PLUGINS DE VERTICAL    │
        │  🇻🇪 Venezuela (BCV, PagoMóvil) │   │  🌭 Food Service (Recetas) │
        │  🇨🇴 Colombia (TRM, Nequi/PSE)  │   │  🏭 Craft Workshop (DTF)   │
        │  🌎 Global (Stripe / USD)      │   │  📏 MTO CPQ (Cotizador)    │
        └────────────────────────────────┘   │  🏬 Barcode Retail (EAN13) │
                                             └────────────────────────────┘
```

### Reglas de Oro de la Modularidad:
1. **El Core no conoce de rubros ni de bancos locales**: El código central no contiene palabras como *"Banesco"*, *"Pago Móvil"*, *"Sublimación"* ni *"Hamburguesa"*.
2. **Cada Plugin es un paquete independiente**: Vive en su propia carpeta en `packages/plugins/{nombre-del-plugin}`, tiene su propio `package.json`, exporta sus componentes visuales, servicios de negocio y tipos.
3. **Licenciamiento Dinámico por Base de Datos**: Cada comercio (*Tenant*) tiene su lista de plugins activos en la tabla `tenant_modules`. Si un comercio no tiene contratado un plugin, su interfaz no se muestra, su código no se ejecuta y sus rutas quedan bloqueadas por el guardián de autorización.

---

## 2. Catálogo Oficial del Ecosistema: Los 13 Plugins Modulares

| Plugin | Directorio / Paquete | Giro / Propósito | Dependencias | Tablas Principales |
| :--- | :--- | :--- | :--- | :--- |
| **`local-venezuela`** | `packages/plugins/local-venezuela` | Pago Móvil, Tasa BCV en vivo, Transferencias y cálculo IGTF 3%. | Ninguna | `exchange_rates`, `exchange_rate_history` |
| **`food-service`** | `packages/plugins/food-service` | Restaurantes, comida rápida, escandallo BOM, insumos y KDS de cocina. | Ninguna | `raw_materials`, `recipes`, `product_modifiers` |
| **`craft-workshop`** | `packages/plugins/craft-workshop` | Talleres de sublimación, vinil, DTF y artes gráficas con merma técnica. | Ninguna | `craft_materials`, `craft_recipes`, `craft_recipe_items`, `craft_quotes` |
| **`mto-cpq`** | `packages/plugins/mto-cpq` | Cotizador Make-to-Order para productos a la medida por área ($m^2$) o volumen. | Ninguna | `cpq_attribute_matrices`, `cpq_pricing_formulas`, `cpq_cost_settings` |
| **`barcode-retail`** | `packages/plugins/barcode-retail` | Supermercados, ferreterías, balanzas comerciales de peso y pasillos. | Ninguna | `product_barcodes` |
| **`invoicing`** | `packages/plugins/invoicing` | Facturación digital/manual, correlativos SENIAT y Libro de Ventas. | `local_venezuela` | `fiscal_documents`, `fiscal_document_items`, `fiscal_sequences` |
| **`purchasing-retentions`** | `packages/plugins/purchasing-retentions` | Facturas de compra y comprobantes de retención IVA (75%/100%) SENIAT. | `local_venezuela` | `purchase_invoices`, `purchase_retentions` |
| **`accounting`** | `packages/plugins/accounting` | Contabilidad NIIF, Plan Único de Cuentas (PUC) y partida doble. | Ninguna | `accounting_accounts`, `journal_entries`, `journal_entry_lines` |
| **`promotions-coupons`** | `packages/plugins/promotions-coupons` | Cupones de descuento fijo o porcentual y promociones automáticas. | Ninguna | `coupons`, `coupon_usages` |
| **`delivery-fleet`** | `packages/plugins/delivery-fleet` | Asignación de pedidos a repartidores propios y liquidación de envíos. | Ninguna | `delivery_zones`, `drivers` |
| **`push-notifications`** | `packages/plugins/push-notifications` | Campañas de marketing y alertas de estado vía Web Push estándar VAPID. | Ninguna | `push_subscriptions`, `push_notification_logs` |
| **`storefront-pro`** | `packages/plugins/storefront-pro` | Maquetador visual de 11 bloques para la vitrina digital del comercio. | Ninguna | `storefront_blocks` |
| **`analytics`** | `packages/plugins/analytics` | Telemetría de tráfico, fuentes (Instagram, TikTok, WhatsApp) y embudo. | Ninguna | `tenant_page_views` |

---

## 3. Contratos de Tipos y Manifiestos de Plugin

Cada plugin debe declarar su contrato mediante un objeto manifiesto que implementa la interfaz `TenantModuleManifest`:

```typescript
// packages/types/src/modules.ts
export type TenantModuleId =
  | "local_venezuela"
  | "food_service"
  | "craft_workshop"
  | "mto_cpq"
  | "barcode_retail"
  | "invoicing"
  | "purchasing_retentions"
  | "accounting"
  | "promotions_coupons"
  | "delivery_fleet"
  | "push_notifications"
  | "storefront_pro"
  | "analytics";

export interface TenantModuleManifest {
  readonly id: TenantModuleId;
  readonly name: string;
  readonly description: string;
  readonly category: "LOCALIZATION" | "VERTICAL" | "OPERATIONS" | "FINANCE" | "MARKETING";
  readonly icon: string;
  readonly requiredPlan: "STARTER" | "GROWTH" | "ENTERPRISE";
  readonly dependencies?: TenantModuleId[];
  readonly conflicts?: TenantModuleId[];
}
```

### Ejemplo: Manifiesto de `craft-workshop`
```typescript
// packages/plugins/craft-workshop/src/manifest.ts
export const CRAFT_WORKSHOP_MANIFEST: TenantModuleManifest = {
  id: "craft_workshop",
  name: "Taller Artesanal & Sublimación",
  description: "Costeo de insumos por paquete, escandallo con merma técnica, mano de obra y presupuestos para WhatsApp.",
  category: "VERTICAL",
  icon: "Scissors",
  requiredPlan: "GROWTH",
};
```

---

## 4. Activación Dinámica y Guardianes de Seguridad

La activación de módulos se almacena en la tabla `tenant_modules` de PostgreSQL. 

### A. Guardián de Rutas en el Panel Administrativo
Toda sub-ruta de plugin en `apps/web/src/app/admin/[plugin]/page.tsx` ejecuta el guardián de autorización canónico en su primera línea:

```typescript
// apps/web/src/app/admin/craft/page.tsx
export default async function CraftPage() {
  // 1. Guardián criptográfico multi-tenant (memoizado con React.cache)
  const { targetTenantId } = await resolveAuthorizedAdminContext();

  // 2. Guardián de licenciamiento de módulo activo
  await assertTenantModuleActive(targetTenantId, "craft_workshop");

  return <CraftWorkshopAdminPanel tenantId={targetTenantId} />;
}
```

Si el comercio no tiene el plugin contratado en su base de datos, `assertTenantModuleActive` redirige inmediatamente al usuario a `/admin?error=module_not_available`, impidiendo cualquier fuga de interfaz o consumo indebido de recursos.

### B. Inyección Condicional en el Menú Lateral (`AdminSidebar`)
El sidebar consulta los `activeModuleIds` del comercio. Si un ítem de navegación requiere un módulo (`requiredModule: "craft_workshop"`), solo se renderiza si `activeModuleIds.includes("craft_workshop")`.

---

## 5. Tutorial: Cómo Crear un Nuevo Plugin en 15 Minutos

Para añadir un nuevo módulo al ecosistema (por ejemplo, `plugin-loyalty-points` para puntos de fidelidad):

### Paso 1: Registrar el ID en `@marketos/types`
En [`packages/types/src/modules.ts`](file:///home/lmontes/Documentos/Telegram/Market/packages/types/src/modules.ts), añade `"loyalty_points"` al tipo `TenantModuleId`.

### Paso 2: Crear el Paquete en `packages/plugins/loyalty-points`
Crea la estructura base del paquete:
```
packages/plugins/loyalty-points/
├── package.json
├── tsconfig.json
└── src/
    ├── manifest.ts          # Metadatos del módulo
    ├── types.ts             # Modelos de puntos y canjes
    ├── components/          # Vistas React del módulo (con "use client" si usan useState)
    ├── services/            # Lógica de cálculo y canje
    └── index.ts             # Exportaciones públicas
```

### Paso 3: Configurar el `package.json`
```json
{
  "name": "@marketos/plugin-loyalty-points",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@marketos/types": "workspace:*",
    "@marketos/ui": "workspace:*",
    "lucide-react": "^1.16.0"
  }
}
```

### Paso 4: Crear la Migración SQL
Crea la migración versionada en `packages/database/supabase/migrations/00035_loyalty_points.sql`:
```sql
CREATE TABLE loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  points_balance INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, customer_id)
);
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;
```

### Paso 5: Crear la Sub-ruta en `apps/web`
Crea `apps/web/src/app/admin/loyalty/page.tsx` protegido con `assertTenantModuleActive(tenantId, 'loyalty_points')`.

### Paso 6: Vincular en `AdminSidebar`
Añade el ítem en la categoría deseada (`MANAGEMENT` u `OPERATIONS`) con `requiredModule: "loyalty_points"`.

---

## 6. Verificación de Aislamiento y Reglas de Calidad

* **Cero Imports Cruzados**: Un plugin jamás debe importar código de otro plugin hermano. Si dos plugins necesitan compartir un tipo o función, esta debe promoverse a `@marketos/types` o `@marketos/utils`.
* **Directiva `"use client"`**: Todo componente visual exportado por un plugin que utilice `useState`, `useEffect` o eventos de usuario debe declarar `"use client";` en su primera línea para garantizar compatibilidad con React Server Components.
* **Idempotencia de Pruebas**: Cada plugin debe incluir su suite de pruebas unitarias (`src/__tests__/run-checks.ts` o archivos `.test.ts` con Vitest).
