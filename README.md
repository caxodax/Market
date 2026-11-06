# 🛒 MarketOS — Multi-Tenant E-Commerce & Omnichannel Retail Platform

> **Versión**: 3.0.0-production  
> **Arquitectura**: Clean Architecture + Hexagonal (Puertos y Adaptadores) + Core Agnóstico con Plugins Modulares (Modelo Odoo / Shopify Apps) + Next.js 16 App Router  
> **Seguridad**: Estándar Criptográfico AgentShield (HMAC-SHA256, RLS Mandatorio y Zero-Trust Multi-Tenant)  
> **Filosofía**: Mobile-First, PWA Omnicanal, Ergonomía de 44px, Rendimiento Low-Cost / Zero-Egress y CLS = 0  

---

## 🧭 Mapa de Documentación y Guía del Conocimiento

Para que cualquier desarrollador, arquitecto o agente de inteligencia artificial entienda el sistema de principio a fin sin perderse, consulta los siguientes documentos especializados:

| Documento | Descripción y Alcance |
| :--- | :--- |
| 📘 [**`README.md`**](file:///home/lmontes/Documentos/Telegram/Market/README.md) | **(Este archivo)** Portal central de bienvenida, estructura del monorepo, instalación y conceptos clave. |
| 🏛️ [**`ARCHITECTURE.md`**](file:///home/lmontes/Documentos/Telegram/Market/ARCHITECTURE.md) | **Especificación de Arquitectura Integral:** Puertos hexagonales, App Router modular (20 sub-rutas), seguridad de sesiones HMAC, capas de caché Edge y micro-interacciones. |
| 🗄️ [**`DATABASE.md`**](file:///home/lmontes/Documentos/Telegram/Market/DATABASE.md) | **Diccionario de Datos de la A a la Z:** Las 33 migraciones SQL, esquemas de tablas Core y Plugins, RPCs atómicos ACID, políticas RLS e índices B-Tree/GIN. |
| 🧩 [**`MARKETOS_MODULAR_ARCHITECTURE.md`**](file:///home/lmontes/Documentos/Telegram/Market/MARKETOS_MODULAR_ARCHITECTURE.md) | **Manual de Plugins y Modularidad:** Especificación del modelo Odoo/Shopify, contratos de manifiestos, inyección de componentes y guía para crear plugins nuevos. |
| 🤖 [**`AI_RULES.md`**](file:///home/lmontes/Documentos/Telegram/Market/AI_RULES.md) | **Reglas de Oro para Agentes IA y Desarrolladores:** Estándares de código, principios de seguridad AgentShield, directrices Ponytail y protocolos de verificación. |
| 🚀 [**`PLAN_MODERNIZACION_UI_UX_PERFORMANCE.md`**](file:///home/lmontes/Documentos/Telegram/Market/PLAN_MODERNIZACION_UI_UX_PERFORMANCE.md) | **Bitácora del Plan de Modernización:** Historial de ejecución de las 5 fases de rendimiento, tipografía, prevención de CLS y diseño responsive. |
| 🎨 [**`BRAND_GUIDELINES.md`**](file:///home/lmontes/Documentos/Telegram/Market/BRAND_GUIDELINES.md) | **Identidad Visual y Tokens de Diseño:** Paleta de colores, tipografías (Plus Jakarta Sans + Outfit), sombras, radios y diseño de interfaz. |
| 🚢 [**`VERCEL_DEPLOYMENT_GUIDE.md`**](file:///home/lmontes/Documentos/Telegram/Market/VERCEL_DEPLOYMENT_GUIDE.md) | **Guía de Despliegue en Producción:** Configuración en Vercel, Supabase, Cloudflare R2, variables de entorno y optimización de cómputo serverless. |

---

## 🌟 ¿Qué es MarketOS?

**MarketOS** es una plataforma SaaS de comercio digital y operaciones omnicanal multi-inquilino (*multi-tenant*). Está diseñada para que comercios independientes (supermercados, restaurantes, talleres de personalización, tiendas de moda y cadenas minoristas) operen con una vitrina digital de alto nivel, sistema de punto de venta (POS), facturación fiscal, control de inventario y despacho, bajo una única infraestructura centralizada de coste operacional casi nulo.

### Pilares Fundamentales:
1. **Core Agnóstico**: El núcleo no conoce de países, monedas fijas ni rubros comerciales específicos. No hay cadenas cableadas como *"Banesco"*, *"Salsas"* ni *"Tallas"*.
2. **Arquitectura de Plugins (Modelo Odoo)**: Las funcionalidades específicas (ej. gastronomía, códigos de barra, cotizadores a medida, impuestos locales) se aíslan en paquetes independientes en `packages/plugins/*` y se licencian por inquilino mediante la base de datos (`tenant_modules`).
3. **Motor Bimonetario Universal**: Soporta operación simultánea en moneda base (USD) y moneda secundaria de curso legal (VES, COP, etc.) con sincronización automática de tasas oficiales (BCV Today).
4. **Cero Salto Visual (CLS = 0)**: Imágenes con reserva estricta de relación de aspecto (`OptimizedImage`), skeletons shimmer y carga adaptativa.
5. **Ergonomía Táctil Móvil**: En pantallas móviles, las tablas complejas se transforman en tarjetas de acción rápida y los modales se abren como *Bottom-Sheets* con tirador físico y áreas táctiles de 44×44px.

---

## 🏗️ Estructura del Monorepo (Turborepo + pnpm)

El proyecto utiliza un espacio de trabajo gestionado con **pnpm workspaces** y orquestado con **Turborepo**:

```
Market/
├── apps/
│   └── web/                                # Aplicación Next.js 16 (App Router + Turbopack)
│       ├── public/                         # Manifiestos PWA, íconos y assets estáticos
│       └── src/
│           ├── app/                        # Rutas públicas, admin y APIs
│           │   ├── admin/                  # Panel modular desacoplado en 20 sub-rutas
│           │   │   ├── layout.tsx          # Shell común con guardia HMAC-SHA256
│           │   │   ├── loading.tsx         # Skeleton universal de transición
│           │   │   ├── payments/           # Conciliación de comprobantes de pago
│           │   │   ├── orders/             # Gestión de órdenes y comanda
│           │   │   ├── inventory/          # Stock multi-tienda y catálogo
│           │   │   ├── pos/                # Punto de Venta táctil y arqueo de caja
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
│           │   │   └── audit/              # Registro inmutable de eventos
│           │   ├── api/                    # Endpoints REST (cron BCV, webhooks, analytics)
│           │   ├── platform/               # Panel exclusivo del Super Administrador SaaS
│           │   └── t/[tenant]/             # Vitrina digital (Storefront PWA multi-tenant)
│           ├── components/                 # Vistas y componentes UI especializados
│           │   ├── admin/                  # Sidebar (4 macro-dominios), header, skeletons
│           │   └── ui/                     # EmptyState, OptimizedImage, BottomSheetModal
│           └── lib/                        # Clientes de caché Edge, Supabase y Excel
├── packages/
│   ├── auth/                               # Sesiones criptográficas HMAC-SHA256 y roles RBAC
│   ├── database/                           # Repositorio central, 33 migraciones SQL y Circuit Breaker
│   │   └── supabase/
│   │       ├── migrations/                 # 33 migraciones secuenciales idempotentes
│   │       └── PRODUCTION_FULL_SETUP.sql   # DDL consolidado de inicialización
│   ├── plugins/                            # Ecosistema de 13 plugins modulares
│   │   ├── accounting/                     # Contabilidad NIIF y Plan Único de Cuentas (PUC)
│   │   ├── analytics/                      # Telemetría de tráfico, embudo y conversión
│   │   ├── barcode-retail/                 # Lectores de barra, pasillos y balanzas comerciales
│   │   ├── craft-workshop/                 # Costeo de sublimación, vinil, DTF y merma técnica
│   │   ├── delivery-fleet/                 # Asignación de repartidores y cálculo por km
│   │   ├── food-service/                   # Escandallo BOM, insumos y pantalla KDS de cocina
│   │   ├── invoicing/                      # Facturación digital/manual y Libro de Ventas SENIAT
│   │   ├── local-venezuela/                # Pago Móvil, tasa BCV en vivo y cálculo IGTF 3%
│   │   ├── mto-cpq/                        # Matrices dimensionales y cotización Make-to-Order
│   │   ├── promotions-coupons/             # Motor de cupones de descuento y promociones
│   │   ├── purchasing-retentions/          # Facturas de compra y comprobantes de retención IVA
│   │   ├── push-notifications/             # Notificaciones masivas Web Push estándar VAPID
│   │   └── storefront-pro/                 # Constructor modular de 11 bloques para vitrina web
│   ├── types/                              # Tipos TypeScript compartidos y Puertos Hexagonales
│   ├── ui/                                 # Componentes compartidos `@marketos/ui`
│   └── utils/                              # Formateo de moneda, R2 storage, WhatsApp links
└── package.json                            # Scripts globales del monorepo
```

---

## ⚡ Guía de Inicio Rápido (Local Development)

### Requisitos Previos:
- **Node.js**: `v20.x` o superior
- **Gestor de Paquetes**: `pnpm` (`v9.x` o superior)
- **Instancia de PostgreSQL / Supabase**: Con extensiones `pgcrypto` y `uuid-ossp`

### 1. Clonar e Instalar Dependencias
```bash
git clone https://github.com/caxodax/Market.git
cd Market
pnpm install
```

### 2. Variables de Entorno
Crea tu archivo `.env.local` en la raíz de `apps/web/` basándote en la plantilla:
```ini
# Supabase & PostgreSQL
NEXT_PUBLIC_SUPABASE_URL="https://tu-proyecto.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="tu-anon-key"
SUPABASE_SERVICE_ROLE_KEY="tu-service-role-key"

# Seguridad Criptográfica de Sesión
SESSION_SECRET="clave-super-secreta-minimo-32-caracteres"

# Almacenamiento Cloudflare R2 (Opcional en desarrollo local)
R2_ACCOUNT_ID="tu-account-id"
R2_ACCESS_KEY_ID="tu-access-key"
R2_SECRET_ACCESS_KEY="tu-secret-key"
R2_BUCKET_NAME="marketos-media"
R2_PUBLIC_URL="https://media.tudominio.com"

# Web Push VAPID (Plugin push-notifications)
NEXT_PUBLIC_VAPID_PUBLIC_KEY="tu-vapid-public-key"
VAPID_PRIVATE_KEY="tu-vapid-private-key"
```

### 3. Ejecución y Comandos Principales
```bash
# Iniciar servidor de desarrollo con Turbopack
pnpm dev

# Verificar tipos de TypeScript en los 20 paquetes
pnpm check-types

# Ejecutar suite de pruebas unitarias e integración (16 suites)
pnpm test

# Compilación para producción (Next.js App Router)
pnpm build
```

---

## 🔒 Seguridad y Aislamiento Multi-Tenant (AgentShield)

MarketOS implementa un modelo de seguridad de **Zero-Trust**:

1. **Sesiones Criptográficas HMAC-SHA256**: Los tokens de sesión se firman criptográficamente en el servidor mediante [`packages/auth`](file:///home/lmontes/Documentos/Telegram/Market/packages/auth). Es matemáticamente imposible que un usuario falsifique su rol o salte a otro comercio modificando la cookie.
2. **Guarda Atómica en Server Actions**: Toda mutación en base de datos invoca obligatoriamente:
   ```typescript
   await assertAuthorizedTenantAdmin(tenantId);
   ```
3. **Licenciamiento Dinámico de Plugins**: Las sub-rutas de módulos protegidos validan el contrato de suscripción:
   ```typescript
   await assertTenantModuleActive(tenantId, 'food_service');
   ```
4. **PostgreSQL Row-Level Security (RLS)**: El 100% de las tablas tienen RLS activo impidiendo fugas de datos incluso ante fallos de aplicación.

---

## 🤝 Reglas de Contribución para Desarrolladores y Agentes

Antes de realizar cualquier cambio en el código:
1. Lee detenidamente [**`AI_RULES.md`**](file:///home/lmontes/Documentos/Telegram/Market/AI_RULES.md).
2. Respeta el principio **Ponytail Ultra**: implementa siempre la solución más simple, limpia y sin sobre-ingeniería que resuelva el problema.
3. Asegura que `pnpm check-types` y `pnpm test` pasen limpios con 0 errores antes de enviar cualquier confirmación.
