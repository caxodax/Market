# MarketOS — Documento Maestro de Arquitectura y Especificación Técnica Integral

> **Versión del Sistema**: 3.0.0-production  
> **Patrón Arquitectónico**: Clean Architecture + Arquitectura Hexagonal (Puertos y Adaptadores) + Core Agnóstico con Plugins Modulares (Modelo Odoo / Shopify Apps) + Next.js 16 App Router  
> **Seguridad y Excelencia**: Estándar Criptográfico AgentShield (ECC) + Ponytail Ultra (Cero Código Muerto, Máxima Simplicidad)  
> **Filosofía de Interfaz**: Mobile-First, PWA Multi-Tenant Aislada, Ergonomía de Pulgar (44px), CLS = 0 y Cero Fricción Comercial  

---

## Índice General

1. [Visión del Sistema y Principios Rectores](#1-visión-del-sistema-y-principios-rectores)
2. [Estructura del Monorepo (Turborepo + pnpm)](#2-estructura-del-monorepo-turborepo--pnpm)
3. [Arquitectura Hexagonal: Puertos, Adaptadores y Ecosistema de Plugins](#3-arquitectura-hexagonal-puertos-adaptadores-y-ecosistema-de-plugins)
4. [Base de Datos & Modelado Relacional (34 Migraciones SQL y RPCs Transaccionales)](#4-base-de-datos--modelado-relacional-34-migraciones-sql-y-rpcs-transaccionales)
5. [Seguridad Integral y Aislamiento Multi-Tenant (AgentShield)](#5-seguridad-integral-y-aislamiento-multi-tenant-agentshield)
6. [Flujos Críticos de Negocio y Ciclo de Vida](#6-flujos-críticos-de-negocio-y-ciclo-de-vida)
7. [Arquitectura Frontend: App Router Modular, Mobile-First y CLS = 0](#7-arquitectura-frontend-app-router-modular-mobile-first-y-cls--0)
8. [Conexiones Externas, APIs y Servicios de Infraestructura](#8-conexiones-externas-apis-y-servicios-de-infraestructura)
9. [Guía de Despliegue, Variables de Entorno y Operaciones](#9-guía-de-despliegue-variables-de-entorno-y-operaciones)

---

## 1. Visión del Sistema y Principios Rectores

MarketOS es una **plataforma SaaS de comercio digital y operaciones omnicanal multi-inquilino**, concebida para permitir que negocios independientes (minimarkets, restaurantes, tiendas de moda, talleres y retail general) operen como si dispusieran de una aplicación propietaria de alta gama, manteniendo una infraestructura unificada y costes operacionales prácticamente nulos (*Low-Cost / Zero-Egress*).

```mermaid
flowchart TD
    subgraph Clientes["Canales de Acceso"]
        PWA["PWA Móvil (Android / iOS / WebAPK)"]
        Desk["Navegador Escritorio / Tablet"]
        POS["Punto de Venta Físico Mostrador (POS)"]
    end

    subgraph Edge["Capa Perimetral & Ruteo"]
        Proxy["Next.js Proxy / Middleware (Resolución de Tenant)"]
        Cache["Edge Data Cache (unstable_cache + SWR)"]
    end

    subgraph Core["MarketOS Core (Agnóstico)"]
        Auth["Auth & Sesiones Criptográficas HMAC"]
        Catalog["Catálogo Base & Sucursales"]
        Cart["Carrito & Checkout Central"]
        Orders["Motor de Pedidos & Tracking QR"]
        Ports["Puertos Hexagonales (Interfaces Puras en @marketos/types)"]
    end

    subgraph Plugins["Ecosistema Modular de Plugins (packages/plugins/*)"]
        P_VE["Localización Venezuela (BCV, Pago Móvil, IGTF)"]
        P_Food["Food Service (Recetas BOM, Modificadores, KDS)"]
        P_POS["POS Registers (Cajas, Turnos, Cortes X/Z)"]
        P_CPQ["MTO CPQ (Cotizador Taller & Matrices)"]
        P_Craft["Craft Workshop (Sublimación, DTF & Merma)"]
        P_Fiscal["Invoicing & Purchasing (SENIAT, Retenciones)"]
        P_Account["Accounting (Contabilidad NIIF & PUC)"]
        P_Push["Push Notifications & Campañas VAPID"]
        P_Studio["Storefront Pro (11 Bloques Dinámicos)"]
    end

    subgraph Infra["Persistencia & Almacenamiento (Infraestructura)"]
        PG["PostgreSQL en Supabase (RLS Estricto + 34 Migraciones)"]
        R2["Cloudflare R2 Object Storage (Zero Egress S3)"]
        BCV["API Oficial BCV (Tasa USD/VES en Vivo)"]
    end

    Clientes --> Proxy
    Proxy --> Cache
    Cache --> Core
    Core <--> Ports
    Ports <--> Plugins
    Core --> PG
    Core --> R2
    Plugins --> PG
    P_VE --> BCV
```

### Principios Fundamentales de Diseño

#### A. Clean Architecture & Principios SOLID
1. **Single Responsibility (SRP)**: Cada paquete, repositorio y Server Action tiene una única causa de modificación. Los repositorios de datos no manipulan HTTP ni cookies; los componentes visuales no ejecutan consultas SQL directas.
2. **Open/Closed (OCP)**: El Core de la plataforma no se modifica para añadir soporte a un país nuevo o a un modelo de negocio específico (e.g. comida rápida vs. supermercados). Toda extensión se realiza creando un plugin que implementa los puertos definidos en [`packages/types/src/ports.ts`](file:///home/lmontes/Documentos/Telegram/Market/packages/types/src/ports.ts).
3. **Liskov Substitution (LSP)**: Cualquier adaptador que cumpla el contrato de un puerto (e.g., `PaymentPort` o `FiscalAdapterPort`) puede sustituir a otro sin alterar la lógica de despacho de órdenes.
4. **Interface Segregation (ISP)**: Los puertos están divididos por capacidades atómicas (`PaymentPort`, `ExchangeRatePort`, `InventoryPort`, `NotificationPort`, `FiscalAdapterPort`). Un plugin de pasarelas de pago no está obligado a conocer sobre inventario ni impuestos.
5. **Dependency Inversion (DIP)**: Los módulos de alto nivel (como el procesamiento de un checkout en `apps/web`) dependen de abstracciones tipadas en TypeScript, mientras que las implementaciones concretas residen en paquetes adaptadores o plugins.

#### B. Core Agnóstico y Modelo Odoo / Shopify Apps
- **El Core no conoce de bancos, divisas fijas ni giros específicos**: No contiene cadenas como `"Banesco"`, `"Pago Móvil"`, `"Salsas"` ni `"Recetas"`.
- **Activación Dinámica por Base de Datos**: Cada comercio (*Tenant*) tiene su propia lista de módulos activos en la tabla `tenant_modules`. Si un comercio no activa `food_service`, su interfaz y sus consultas SQL no cargan modificadores de cocina ni generan sobrecostes de renderizado.

#### C. Eficiencia Operativa Extrema (Zero-Egress & Low-Cost)
- **Frontend / Serverless**: Next.js 16 desplegado en Vercel (Edge Runtime y Node Serverless).
- **Base de Datos**: PostgreSQL en Supabase con Row-Level Security (RLS) mandatorio e indexación B-Tree/GIN de alto impacto.
- **Almacenamiento de Archivos**: Cloudflare R2 (compatible con API S3, con 10 GB de almacenamiento gratuito y **cero coste por transferencia saliente / zero egress**).
- **Caché en Capa Edge**: [`unstable_cache`](file:///home/lmontes/Documentos/Telegram/Market/apps/web/src/lib/cached-queries.ts) de Next.js con SWR e invalidación bajo demanda con tags (`revalidateTag`), reduciendo drásticamente las lecturas a PostgreSQL (<15 ms en peticiones repetidas).

---

## 2. Estructura del Monorepo (Turborepo + pnpm)

El proyecto está organizado como un monorepo administrado mediante **Turborepo** y **pnpm workspaces**:

```
Market/
├── apps/
│   └── web/                                # Aplicación Next.js 16 (App Router + Turbopack)
│       ├── public/                         # Assets estáticos globales y Service Worker
│       └── src/
│           ├── app/                        # Rutas canónicas (Storefront, Admin, APIs)
│           │   ├── actions.ts              # Server Actions públicas (checkout, rastreo)
│           │   ├── admin/                  # Panel de administración fragmentado en 20 sub-rutas
│           │   │   ├── layout.tsx          # Shell canónico con guardián HMAC-SHA256
│           │   │   ├── loading.tsx         # Skeleton universal de transición
│           │   │   ├── admin-context.ts    # Contexto ligero para compartir datos del tenant
│           │   │   ├── payments/           # Conciliación de comprobantes de pago
│           │   │   ├── orders/             # Gestión de órdenes y despacho
│           │   │   ├── inventory/          # Catálogo y control de stock
│           │   │   ├── pos/                # Punto de Venta táctil (/admin/pos)
│           │   │   ├── delivery/           # Asignación y tracking de motorizados
│           │   │   ├── invoicing/          # Facturación SENIAT y correlativos
│           │   │   ├── purchasing/         # Compras a proveedores y retenciones IVA
│           │   │   ├── reports/            # Reportes de venta y Libro Fiscal
│           │   │   ├── settings/           # Ajustes de marca, dominio y monedas
│           │   │   ├── stores/             # Sedes físicas y sucursales
│           │   │   ├── staff/              # Empleados, cajeros y permisos RBAC
│           │   │   ├── storefront-studio/  # Maquetador visual de la vitrina digital
│           │   │   ├── food-service/       # Insumos y recetas de cocina (Plugin)
│           │   │   ├── mto-cpq/            # Cotizador Make-to-Order (Plugin)
│           │   │   ├── craft/              # Taller de sublimación y DTF (Plugin)
│           │   │   ├── coupons/            # Cupones y promociones (Plugin)
│           │   │   ├── push/               # Campañas Web Push VAPID (Plugin)
│           │   │   ├── plugins/            # Marketplace y activación de módulos
│           │   │   └── audit/              # Registro forense inmutable de eventos
│           │   ├── api/                    # Endpoints REST y Webhooks
│           │   │   ├── analytics/          # Registro de tráfico y métricas en vivo
│           │   │   ├── cron/               # Tareas programadas (Sincronización BCV)
│           │   │   ├── manifest/           # Web App Manifest PWA dinámico por tenant
│           │   │   └── media/              # Subida de comprobantes y fotos a R2
│           │   ├── platform/               # Panel del Super Administrador (/platform)
│           │   ├── t/[tenant]/             # Storefront canónico aislado por ruta
│           │   └── proxy.ts                # Detección y reescritura de subdominios
│           ├── components/                 # Vistas y componentes especializados
│           │   ├── admin/                  # AdminLayoutShell, AdminSidebar, AdminHeader, AdminSkeleton
│           │   └── ui/                     # EmptyState, BottomSheetModal
│           ├── context/                    # Contextos de React (Carrito, Favoritos)
│           └── lib/                        # Clientes de caché, compresión y Excel
├── packages/
│   ├── auth/                               # Seguridad, roles RBAC y sesiones HMAC-SHA256
│   ├── database/                           # Repositorios, 34 migraciones SQL y Circuit Breaker
│   │   └── supabase/
│   │       ├── migrations/                 # 34 migraciones SQL versionadas e idempotentes
│   │       └── PRODUCTION_FULL_SETUP.sql   # DDL consolidado de producción
│   ├── plugins/                            # Ecosistema de 13 plugins modulares
│   │   ├── accounting/                     # Contabilidad NIIF y Plan Único de Cuentas (PUC)
│   │   ├── analytics/                      # Métricas de tráfico, fuentes y conversión
│   │   ├── barcode-retail/                 # Códigos EAN-13, pasillos y balanzas comerciales
│   │   ├── craft-workshop/                 # Sublimación, DTF, vinil textil y merma técnica
│   │   ├── delivery-fleet/                 # Asignación de motorizados y tarifas por km
│   │   ├── food-service/                   # Recetas BOM, modificadores y comandas KDS
│   │   ├── invoicing/                      # Facturas, notas y Libro de Ventas SENIAT
│   │   ├── local-venezuela/                # Pago Móvil, tasa BCV en vivo e IGTF 3%
│   │   ├── mto-cpq/                        # Cotizador Make-to-Order para talleres
│   │   ├── promotions-coupons/             # Cupones de descuento y promociones
│   │   ├── purchasing-retentions/          # Facturas de compra y retenciones IVA SENIAT
│   │   ├── push-notifications/             # Notificaciones masivas Web Push VAPID
│   │   └── storefront-pro/                 # Maquetador modular de 11 bloques visuales
│   ├── types/                              # Definiciones TypeScript y Puertos Hexagonales
│   ├── ui/                                 # Librería de componentes compartidos (@marketos/ui, OptimizedImage, ThemeProvider)
│   └── utils/                              # Utilidades de R2, fechas, WhatsApp y plugins
└── package.json                            # Scripts globales de compilación y pruebas
```

---

## 3. Arquitectura Hexagonal: Puertos, Adaptadores y Ecosistema de Plugins

### Contratos de Puertos ([`packages/types/src/ports.ts`](file:///home/lmontes/Documentos/Telegram/Market/packages/types/src/ports.ts))

Los puertos definen las operaciones que el Core puede delegar a los plugins sin acoplarse a su implementación:

```typescript
// 1. Puerto de Pagos Bimonetarios
export interface PaymentPort {
  readonly id: string;
  readonly name: string;
  processPayment(order: Order, payload: PaymentSubmissionPayload): Promise<PaymentResult>;
  verifyPayment(proofId: string, verifierId: string): Promise<PaymentVerificationResult>;
}

// 2. Puerto de Tasas Cambiarias Oficiales
export interface ExchangeRatePort {
  readonly currencyCode: CurrencyCode;
  fetchLiveRate(): Promise<ExchangeRateSnapshot>;
}

// 3. Puerto de Facturación Fiscal y Conexión SENIAT
export interface FiscalAdapterPort {
  issueInvoice(document: FiscalDocumentDraft): Promise<FiscalDocumentIssued>;
  generateSalesBook(tenantId: string, period: string): Promise<FiscalSalesBookReport>;
}

// 4. Puerto de Notificaciones Multicanal
export interface NotificationPort {
  sendPush(subscription: PushSubscription, payload: PushNotificationPayload): Promise<void>;
  formatWhatsAppOrderMessage(order: Order, settings: TenantSettings): string;
}
```

### Resolución de Dependencias y Ciclo de Vida de Módulos

El motor en [`packages/utils/src/plugin-resolver.ts`](file:///home/lmontes/Documentos/Telegram/Market/packages/utils/src/plugin-resolver.ts) gestiona el ciclo de vida de los módulos evitando inconsistencias tributarias o de negocio:
- **Activación en Cascada (`REQUIRES` / `AUTO_ACTIVATE`)**: Activar un módulo avanzado (ej. `invoicing`) activa de forma automática sus dependencias requeridas (ej. `local_venezuela`).
- **Desactivación en Cascada**: Desactivar un módulo base apaga de forma segura todos los módulos superiores dependientes.
- **Resolución de Conflictos Territoriales (`CONFLICTS`)**: Evita que un comercio active simultáneamente localizaciones mutuamente excluyentes (como `local_venezuela` y `local_colombia`).

---

## 4. Base de Datos & Modelado Relacional (34 Migraciones SQL y RPCs Transaccionales)

La base de datos reside en **PostgreSQL (Supabase)**, con tipado estricto, integridad referencial en cascada, auditoría inmutable, procedimientos almacenados transaccionales (RPC) y Row-Level Security (RLS) en el 100% de las tablas.

### Catálogo Cronológico de las 34 Migraciones

| Migración | Nombre / Identificador | Propósito Arquitectónico y Tablas Creadas |
| :---: | :--- | :--- |
| **00001** | `initial_schema.sql` | Fundamentos: `tenants`, `tenant_settings`, `stores`, `profiles`, `categories`, `products`, `inventory`, `orders`, `order_items`, `payments`, `audit_logs`. |
| **00002** | `seed_shop_market.sql` | Datos semilla para el primer tenant piloto: **Shop Market C.A.** (Nueva Segovia, Barquisimeto). |
| **00003** | `phase_2_operational.sql` | Operaciones: `coupons`, `delivery_zones`, `drivers`, trazabilidad operativa. |
| **00004** | `phase_3_saas_multi_tenant.sql` | SaaS: Planes de suscripción, límites de productos y sucursales por tenant. |
| **00005** | `phase_4_production_hardening.sql` | Triggers automáticos para actualizar `updated_at` y restricciones de consistencia. |
| **00006** | `auth_roles_profiles.sql` | RBAC: Definición del enum `app_role` y sincronización bidireccional con `auth.users`. |
| **00007** | `supabase_cron_bcv_sync.sql` | Automatización: Configuración de `pg_cron` y `pg_net` para sincronizar la tasa BCV vía API. |
| **00008** | `exchange_rate_history.sql` | Auditoría de divisas: Tabla `exchange_rate_history` con tasa histórica para cierres contables. |
| **00009** | `tenant_brand_and_payment_settings.sql` | Identidad: Configuración visual y pasarelas de pago habilitadas (Pago Móvil, Zelle, Efectivo). |
| **00010** | `push_notifications.sql` | PWA Push: `push_subscriptions` (VAPID) y `push_notification_logs` para envíos masivos. |
| **00011** | `customer_id_number_ci_rif.sql` | Identificación fiscal: Agrega `id_number` (Cédula / RIF) en perfiles y clientes. |
| **00012** | `fiscal_billing_settings.sql` | Facturación: Parámetros de IGTF (3%), alícuota general de IVA y RIF de la empresa. |
| **00013** | `custom_domains.sql` | Multitenancy avanzado: Columna `custom_domain` con índice único en `tenants`. |
| **00014** | `global_audit_trail_hardening.sql` | Trazabilidad inmutable: Registros forenses con dirección IP, User-Agent y metadatos JSONB. |
| **00015** | `tenant_modules_and_food_service.sql` | Módulos y Restaurantes: `tenant_modules`, `raw_materials`, `recipes`, `product_modifier_groups`, `product_modifiers`. |
| **00016** | `platform_settings.sql` | Configuración global del Super Administrador: pasarelas maestras y switch de mantenimiento. |
| **00017** | `mto_cpq_engine.sql` | Fabricación bajo pedido: `cpq_attribute_matrices`, `cpq_pricing_formulas`, fichas de taller. |
| **00018** | `storefront_pro.sql` | Maquetador de vitrina: Tabla `storefront_blocks` (11 tipos de bloques dinámicos ordenables). |
| **00019** | `tenant_performance_indexes.sql` | Optimización de lectura: Índices compuestos B-Tree y GIN para consultas <10 ms. |
| **00020** | `barcode_retail_engine.sql` | Retail físico: Índices de código de barras EAN-13, gestión de bultos y pasillos de almacén. |
| **00021** | `cpq_configurable_deposit.sql` | Finanzas CPQ: Gestión de porcentajes de anticipo configurables por cotización. |
| **00022** | `food_service_kitchen_hardening.sql` | Cocina KDS: Comandas en tiempo real y estados de preparación para cocineros. |
| **00023** | `pos_registers.sql` | Punto de Venta: `pos_registers`, `pos_shifts` (turnos), `pos_cash_movements`, arqueo ciego, corte X y corte Z. |
| **00024** | `tenant_analytics.sql` | Métricas de negocio: `tenant_page_views`, fuentes de tráfico (WhatsApp, IG) y embudos. |
| **00025** | `fiscal_documents.sql` | Documentos fiscales: `fiscal_documents`, `fiscal_document_items`, Libro de Ventas SENIAT. |
| **00026** | `purchasing_and_retentions.sql` | Compras: `purchase_invoices`, comprobantes de retención IVA (75%/100%) y exportación TXT SENIAT. |
| **00027** | `accounting_and_commissions.sql` | Contabilidad NIIF: `accounting_accounts` (PUC 4 niveles), `journal_entries`, `journal_entry_lines`, comisiones fintech. |
| **00028** | `atomic_fiscal_sequences.sql` | Secuencias legales: `fiscal_sequences` con bloqueo `FOR UPDATE` para numeración consecutiva atómica. |
| **00029** | `schema_cleanup_and_bimonetary.sql` | Poda y Moneda Dual: Eliminación de tablas muertas (`user_profiles`, `mto_quote_requests`, `mto_materials`), soporte de peso fraccionario (`NUMERIC(12,3)` en inventario), monedas duales y balance segregado en `pos_shifts`. |
| **00030** | `core_transactional_rpcs.sql` | Stored Procedures ACID: `rpc_create_order_atomic`, `rpc_issue_fiscal_document`, `rpc_close_pos_shift` y `rpc_get_sales_book`. |
| **00031** | `profiles_email_unique.sql` | Integridad de usuarios: Índice único sobre `email` en la tabla `profiles` para evitar duplicidad de colaboradores. |
| **00032** | `fix_profiles_rls_recursion.sql` | Corrección RLS: Erradicación de bucles de recursión infinita en las políticas de seguridad de perfiles. |
| **00033** | `craft_workshop_plugin.sql` | Taller de sublimación y DTF: `craft_materials` (insumos por bulto/paquete con costo unitario computado), `craft_recipes` (fichas de escandallo con merma y mano de obra), `craft_recipe_items` (fórmulas relacionales), `craft_quotes` (presupuestos con 50% de anticipo) y procedimiento `rpc_recalculate_craft_recipes`. |
| **00034** | `decouple_core_rpcs.sql` | Desacoplamiento de RPCs del Core: Ordenamiento determinista (`ORDER BY product_id ASC FOR UPDATE`) para erradicar deadlocks bajo concurrencia, comprobación dinámica de módulos en `tenant_modules` y totales bimonetarios canónicos. |

---

## 5. Seguridad Integral y Aislamiento Multi-Tenant (AgentShield)

El estándar **AgentShield (ECC)** implementa una defensa en profundidad de tres capas para garantizar que **ningún comercio pueda acceder, alterar o visualizar información de otro**:

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as Usuario / Navegador
    participant Proxy as Next.js Proxy / Layout Canónico
    participant Action as Server Action (Backend)
    participant Auth as Guardián Criptográfico HMAC
    participant Repo as Repositorio Scoped
    participant DB as PostgreSQL (RLS Activo)

    Cliente->>Proxy: Petición HTTP (Host / Cookie)
    Proxy->>Action: Resuelve tenant y pasa contexto
    Action->>Auth: assertAuthorizedTenantAdmin(tenantId)
    Note over Auth: Verifica firma HMAC-SHA256<br/>Valida rol y pertenencia al tenant
    alt Token inválido o Tenant cruzado
        Auth-->>Cliente: 403 Forbidden / Error de Autorización
    else Token verificado y autorizado
        Auth->>Repo: Continúa ejecución con credenciales validadas
        Repo->>DB: Consulta forzada: .eq("tenant_id", tenantId)
        DB-->>Repo: Dataset filtrado por RLS
        Repo-->>Action: Datos procesados
        Action-->>Cliente: Respuesta JSON segura
    end
```

### Reglas Críticas de Seguridad Aplicadas

1. **Sesiones Criptográficas HMAC-SHA256**:
   - Ubicación: [`packages/auth/src/session.ts`](file:///home/lmontes/Documentos/Telegram/Market/packages/auth/src/session.ts).
   - Todo token de sesión viaja como una cookie segura (`httpOnly`, `secure`, `sameSite: lax`).
   - El payload se firma con clave secreta (`SESSION_SECRET`). **Se ha erradicado todo bypass de cadenas JSON no firmadas**. Cualquier token adulterado es revocado automáticamente.

2. **Autorización Obligatoria en Server Actions**:
   - Ubicación: [`apps/web/src/app/admin/actions.ts`](file:///home/lmontes/Documentos/Telegram/Market/apps/web/src/app/admin/actions.ts).
   - Ninguna acción administrativa (modificar inventario, cambiar precios, aprobar pagos, configurar cupones o crear zonas) confía en el `tenantId` enviado por el navegador.
   - Toda mutación pasa por `assertAuthorizedTenantAdmin(tenantId)`:
     ```typescript
     const user = await assertAuthorizedTenantAdmin(tenantId);
     // Solo continúa si user.role === 'PLATFORM_SUPER_ADMIN' o user.tenant_id === tenantId
     ```

3. **Guardián de Licenciamiento Dinámico de Plugins**:
   - Toda sub-ruta de plugin en el panel administrativo invoca:
     ```typescript
     await assertTenantModuleActive(tenantId, moduleId);
     ```
   - Si el comercio intenta acceder por URL directa a un módulo que no tiene contratado en `tenant_modules`, es redirigido inmediatamente a `/admin?error=module_not_available`.

4. **Row-Level Security (RLS) Mandatorio en PostgreSQL**:
   - El 100% de las tablas tienen RLS habilitado (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
   - Las lecturas públicas (Storefront) se restringen estrictamente a datos de comercios con `status = 'active'`.
   - Las escrituras quedan limitadas al usuario autenticado con pertenencia válida al `tenant_id`.

---

## 6. Flujos Críticos de Negocio y Ciclo de Vida

### A. Resolución de Tenant en Tiempo de Ejecución
La resolución del comercio se ejecuta de forma perimetral de latencia cero en [`apps/web/src/proxy.ts`](file:///home/lmontes/Documentos/Telegram/Market/apps/web/src/proxy.ts) y [`apps/web/src/app/page.tsx`](file:///home/lmontes/Documentos/Telegram/Market/apps/web/src/app/page.tsx):
1. **Dominio Personalizado**: Si la cabecera `host` es `pedidos.mimercado.com`, el proxy perimetral en Edge reescribe internamente la URL hacia `?tenant=pedidos.mimercado.com` sin tocar la base de datos (0ms overhead). La resolución del tenant se efectúa en servidor mediante `getCachedTenant()`, respaldada por la caché de datos de Next.js (`unstable_cache`) con clave `tenant-routing:${host}` y tag `tenant:${tenantId}:settings`, evitando consultas SQL redundantes en cada petición.
2. **Subdominio de Plataforma**: Si la cabecera es `mimercado.marketos.app`, extrae `mimercado` como identificador de tenant.
3. **Ruta Canónica Aislada**: En el dominio principal, las peticiones se enrutan de forma canónica hacia `/t/[tenant]` (e.g. `/t/shop-market`), lo cual aísla el contexto del Web App Manifest y permite instalar múltiples tiendas en el mismo dispositivo móvil.

### B. Ciclo de Vida de la Orden de Compra
```mermaid
stateDiagram-v2
    [*] --> CREATED: Cliente genera orden desde el carrito
    CREATED --> PAYMENT_PENDING: Carga de referencia y comprobante
    PAYMENT_PENDING --> PAYMENT_APPROVED: Administrador / Cajero aprueba pago
    PAYMENT_PENDING --> CANCELLED: Comprobante rechazado o vencido
    PAYMENT_APPROVED --> PREPARING: Cocina (KDS), Taller (Craft) o Picking en almacén
    PREPARING --> READY: Orden empaquetada y lista
    READY --> DELIVERING: Asignada a chofer (Delivery)
    READY --> COMPLETED: Retirada en tienda (Pick-up)
    DELIVERING --> COMPLETED: Entrega confirmada con cliente
    COMPLETED --> [*]
```

### C. Motor Cambiario Multi-Moneda y Tasa BCV
- La moneda base de cotización de los productos es **USD**.
- Para operaciones en Venezuela, el sistema consulta la tasa oficial mediante el endpoint de `bcv.today` (`https://bcv.today/api/v1/rate.json`).
- Los valores se almacenan con caché en memoria y respaldo en la tabla `exchange_rates`.
- En el Storefront y el POS, los importes se convierten automáticamente en tiempo real:
  $$\text{Precio en VES} = \text{Precio en USD} \times \text{Tasa BCV del Día}$$
- En caso de pagos en divisas bajo legislación venezolana, el motor aplica de forma automática el cálculo del **3% IGTF**.

---

## 7. Arquitectura Frontend: App Router Modular, Mobile-First y CLS = 0

El frontend de MarketOS ha sido modernizado bajo estándares de ingeniería de alto rendimiento:

### A. Desacoplamiento Modular del Panel `/admin`
El antiguo archivo monolítico de 1.800 líneas ha sido segmentado en **20 sub-rutas independientes** con Server Components de Next.js 16:
- **Layout Canónico (`apps/web/src/app/admin/layout.tsx`)**: Centraliza la autenticación, carga paralela de ajustes y perfil de usuario, y provee el shell visual [`AdminLayoutShell`](file:///home/lmontes/Documentos/Telegram/Market/apps/web/src/components/admin/admin-layout-shell.tsx).
- **Cero Pantallas en Blanco**: Cada sub-ruta posee su propio `loading.tsx` con esqueletos de carga visual [`AdminSkeleton`](file:///home/lmontes/Documentos/Telegram/Market/apps/web/src/components/admin/admin-skeleton.tsx).
- **Revalidación Quirúrgica**: Las mutaciones ya no recargan un estado monolítico en memoria; ejecutan `revalidatePath('/admin/orders')` o `revalidatePath('/admin/payments')` para refrescar solo los datos necesarios en milisegundos.

### B. Menú Lateral en 4 Macro-dominios ([`AdminSidebar`](file:///home/lmontes/Documentos/Telegram/Market/apps/web/src/components/admin/admin-sidebar.tsx))
La navegación se estructura en 4 macro-categorías para reducir la carga cognitiva del usuario:
1. **OPERACIONES DEL DÍA**: Pagos por Conciliar, Pedidos Activos, Cajas POS, Delivery.
2. **CATÁLOGO & STOCK**: Inventario Multitienda, Food Service, MTO CPQ, Taller Artesanal.
3. **FINANZAS & FISCAL**: Tasa Oficial BCV, Facturas SENIAT, Compras & Retenciones, Contabilidad NIIF, Reportes de Venta.
4. **ADMINISTRACIÓN & TIENDA**: Ajustes Generales, Sucursales, Equipo & Roles, Vitrina Pro (Storefront), Cupones, Notificaciones Push, Plugins, Auditoría.

### C. Estabilidad Visual Absoluta (CLS = 0)
- **Componente [`OptimizedImage`](file:///home/lmontes/Documentos/Telegram/Market/packages/ui/src/components/optimized-image.tsx)**:
  - Reserva matemática estricta del espacio en el DOM (`aspectRatio: square | video | wide | portrait`).
  - Efecto de carga shimmer que previene cualquier salto de contenido durante la descarga de imágenes.
  - Fallback automático con icono ante imágenes rotas o nulas.

### D. Patrón Híbrido Responsive y Modales Bottom-Sheet
- **Escritorio (`≥ 768px`)**: Tablas de alta densidad de información con ordenamiento y paginación.
- **Móvil (`< 768px`)**: Tarjetas táctiles individuales sin barra de desplazamiento horizontal (`overflow-x`).
- **Modales Bottom-Sheet ([`bottom-sheet-modal.tsx`](file:///home/lmontes/Documentos/Telegram/Market/apps/web/src/components/ui/bottom-sheet-modal.tsx))**:
  - En móviles, los modales se anclan a la parte inferior de la pantalla (`rounded-t-[28px]`).
  - Tirador físico de arrastre (`w-12 h-1.5`) y botones de cierre ergonómicos de $44 \times 44\,\text{px}$.
  - Animaciones fluidas gobernadas por física cúbica (`cubic-bezier(0.16, 1, 0.3, 1)`).

---

## 8. Conexiones Externas, APIs y Servicios de Infraestructura

| Servicio / API | Proveedor | Finalidad en MarketOS | Modo de Autenticación / Credenciales |
| :--- | :--- | :--- | :--- |
| **PostgreSQL & Auth** | Supabase | Base de datos relacional, Auth RBAC y RLS. | API URL, Anon Publishable Key y Service Role Key en backend. |
| **Object Storage** | Cloudflare R2 | Almacenamiento S3 de fotos de productos, logos y comprobantes. | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`. |
| **Tasa Oficial USD/VES** | BCV Today API | Sincronización diaria del tipo de cambio oficial de Venezuela. | Endpoint público HTTP: `https://bcv.today/api/v1/rate.json`. |
| **Web Push API** | VAPID / W3C | Notificaciones push de marketing y cambios de estado en PWA. | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`. |
| **Impresión Térmica** | ESC/POS Nativo | Impresión directa de tickets de comanda y cortes de caja en 58/80mm. | Conexión WebUSB / Bluetooth en navegador del POS sin drivers externos. |

---

## 9. Guía de Despliegue, Variables de Entorno y Operaciones

### Variables de Entorno Requeridas (`.env.production`)

```bash
# ─── 1. SUPABASE (BASE DE DATOS & AUTH) ──────────────────────────────
NEXT_PUBLIC_SUPABASE_URL="https://tu-proyecto.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="tu-clave-publica-anon"
SUPABASE_SERVICE_ROLE_KEY="tu-clave-privada-service-role"

# ─── 2. DOMINIO Y ENRUTAMIENTO MULTI-TENANT ──────────────────────────
NEXT_PUBLIC_PLATFORM_DOMAIN="marketos.app"
DEFAULT_TENANT_ID="shop-market-ca"

# ─── 3. CLOUDFLARE R2 (STORAGE ZERO-EGRESS) ──────────────────────────
R2_ACCOUNT_ID="tu-account-id-cloudflare"
R2_ACCESS_KEY_ID="tu-access-key-id"
R2_SECRET_ACCESS_KEY="tu-secret-access-key"
R2_BUCKET_NAME="marketos-media"
NEXT_PUBLIC_R2_PUBLIC_URL="https://media.marketos.app"

# ─── 4. SEGURIDAD DE SESIÓN (AGENTSHIELD) ─────────────────────────────
SESSION_SECRET="generar-cadena-aleatoria-de-64-caracteres-minimo"

# ─── 5. WEB PUSH NOTIFICATIONS (VAPID) ────────────────────────────────
NEXT_PUBLIC_VAPID_PUBLIC_KEY="tu-clave-publica-vapid"
VAPID_PRIVATE_KEY="tu-clave-privada-vapid"
VAPID_SUBJECT="mailto:soporte@marketos.app"
```

### Comandos de Compilación y Verificación

```bash
# Instalar dependencias en todo el monorepo
pnpm install

# Ejecutar suite de pruebas unitarias y de arquitectura (16 suites)
pnpm test

# Verificar tipos TypeScript en los 20 paquetes
pnpm check-types

# Compilar proyecto completo para producción con Turbopack
pnpm build
```

---

> **Mantenimiento del Documento**: Cualquier cambio en el esquema de base de datos, adición de plugins a `packages/plugins/*`, o modificación en los contratos de `ports.ts` debe reflejarse en este documento maestro respetando la numeración de migraciones y los principios de aislamiento multi-tenant.
