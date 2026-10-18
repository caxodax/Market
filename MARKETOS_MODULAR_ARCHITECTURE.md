# MarketOS — Arquitectura Modular: Core y Sistema de Plugins

Este documento establece la **especificación técnica oficial** para la modularización de **MarketOS**, basada en el patrón de arquitectura de **Odoo / Shopify Apps**. 

Garantiza que la plataforma pueda operar en múltiples países y adaptarse a diferentes giros de negocio (supermercados, comida rápida, tiendas deportivas, etc.) **sin duplicar código, sin crear ramas paralelas de Git y permitiendo que nuevos programadores colaboren de forma segura e independiente**.

---

## 1. Principio Fundamental de Diseño

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       MARKETOS CORE (Agnóstico)                         │
│   Auth • Carrito • Pedidos • Tracking QR • Sedes • Storage • WhatsApp   │
└───────────────────┬─────────────────────────────────┬───────────────────┘
                    │                                 │
     ┌──────────────┴──────────────┐   ┌──────────────┴──────────────┐
     │   PLUGINS DE LOCALIZACIÓN   │   │     PLUGINS DE NEGOCIO      │
     │  🇻🇪 Venezuela (Pago Móvil/BCV)│  │  🌭 Gastronomía (Pulldog)   │
     │  🇨🇴 Colombia (Nequi/PSE)   │   │  🏬 Supermercados (Shop)    │
     │  🌎 Global (Stripe/PayPal) │   │  👟 Moda y Tallas (KsaSport)│
     └─────────────────────────────┘   └─────────────────────────────┘
```

1. **El Core no conoce países ni modelos específicos:** No contiene nombres de bancos locales (Banesco, Nequi), monedas locales fijas ni conceptos exclusivos de un rubro (como "receta de perro caliente" o "talla de zapato").
2. **Los Plugins son paquetes autocontenidos:** Cada plugin vive en su propia carpeta dentro del monorepo (`packages/plugins/*`) y define sus propios tipos, componentes visuales, servicios y migraciones.
3. **Activación dinámica por Base de Datos:** Cada comercio (*Tenant*) tiene una lista de plugins activos en la tabla `tenant_modules`. Si un plugin está inactivo para un cliente, su código no se ejecuta ni ensucia su interfaz.

---

## 2. Catálogo Oficial: Core vs. Plugins

### 🟦 A. MarketOS Core (Obligatorio para el 100% de los clientes)
*Funcionalidades estándar compartidas por cualquier comercio en cualquier país:*

* **1. Multi-Tenant y Autenticación:** Control de comercios, subdominios/dominios personalizados y control de acceso basado en roles (Superadmin, Dueño, Cajero).
* **2. Catálogo Base de Productos:** Título, descripción, precio base en moneda principal, fotos, categorías y estado (activo/inactivo/agotado).
* **3. Carrito y Checkout Central:** Selección de ítems, resumen de compra, formulario de datos de contacto (nombre, teléfono, notas).
* **4. Motor de Pedidos y Tracking:** Generación de ID único (`ORD-XXXXXX`), generación de ticket digital, código QR y pantalla pública de rastreo.
* **5. Despacho Base:** Retiro en Tienda (*Pick-up*) y Delivery por Zonas con recargos configurables.
* **6. Gestión de Sedes / Sucursales:** Soporte para 1 o múltiples sucursales con dirección, teléfono y horarios independientes.
* **7. Notificaciones WhatsApp:** Formateador del mensaje de orden para envío directo con un clic.
* **8. Almacenamiento de Medios (Media Storage):** Subida y optimización de imágenes en Cloudflare R2 / Supabase Storage.
* **9. Interfaces Abstractas (Adapters):** Interfaces genéricas para inyectar pasarelas de pago (`PaymentAdapter`) y proveedores de tipo de cambio (`ExchangeRateProvider`).

---

### 🟩 B. Plugins de Localización (Por País)

#### 🇻🇪 `plugin-local-venezuela`
* **Pasarelas de Pago Nacionales:** Pago Móvil (banco, teléfono, cédula, validación de referencia), Transferencias Bancarias (Banesco, Mercantil, Venezuela, etc.), Zelle y Efectivo divisas/bolívares.
* **Tasa Oficial BCV:** Sincronizador automático con la API oficial del Banco Central de Venezuela, cálculo en tiempo real y memoria caché.
* **Facturación SENIAT e IGTF:** Cálculo del 3% IGTF sobre pagos en divisas y conexión fiscal (The Factory HKA / emulación de factura electrónica).

#### 🇨🇴 `plugin-local-colombia`
* **Pasarelas de Pago:** Nequi, Daviplata, PSE, Transferencias Bancolombia.
* **Tasa:** Tasa Representativa del Mercado (TRM / Banco de la República).
* **Facturación DIAN:** Mapeo de impuestos (IVA 19%, Impoconsumo) y factura electrónica.

#### 🌎 `plugin-local-global`
* Pasarelas internacionales estándar con tarjeta de crédito/débito (Stripe, Mercado Pago o PayPal).

---

### 🟨 C. Plugins de Giro de Negocio (Verticales)

#### 🌭 `plugin-food-service` *(Caso de Uso: Pulldog / Comida Rápida / Restaurantes)*
* **Modificadores y Opciones al Cliente (Storefront):**
  * Modal al seleccionar platillos: selección de salsas (gratis), tipo de pan, toppings adicionales con costo (tocineta +$1.00, queso fundido +$0.50).
* **Control de Materia Prima e Insumos (Admin):**
  * Inventario de ingredientes por sede (panes, salchichas, carne, queso, salsas, vasos, servilletas).
* **Motor de Recetas y Escandallo (BOM - Bill of Materials):**
  * Relación producto -> receta (ej. 1 Perro Tradicional = 1 Pan + 1 Salchicha + 0.02 kg Papas).
  * Descuento automático de insumos en tiempo real con cada venta concretada.
  * Alertas de stock crítico para reabastecimiento de sedes.
* **Pantalla de Cocina / KDS (Kitchen Display System):**
  * Vista simplificada en tiempo real para cocineros sin datos de dinero.

#### 🏬 `plugin-barcode-retail` *(Caso de Uso: Shop Market / Supermercados / Ferreterías)*
* **Lector de Código de Barras:** Búsqueda y cobro rápido con escáner físico USB o cámara del dispositivo.
* **Inventario Directo 1 a 1:** Descuento directo por unidad o peso.
* **Importador / Exportador Masivo en Excel:** Carga de catálogos de 5.000+ productos en lote.
* **Pasillos y Ubicaciones:** Control de estantería física para agilizar el picking.

#### 👟 `plugin-clothing-variants` *(Caso de Uso: KsaSport / Ropa y Calzado)*
* **Matriz de Variantes:** Talla (S, M, L / 38, 39, 40) x Color (Negro, Blanco, Azul).
* **Inventario por Variante:** Stock específico para cada combinación de atributo.

---

### 🟧 D. Plugins de Operaciones y Crecimiento (Planes Superiores)

* **`plugin-promotions-coupons`:** Códigos promocionales (`BIENVENIDO`, `PULLDOG10`), descuentos automáticos por volumen o combos 2x1.
* **`plugin-delivery-fleet`:** Asignación de pedidos a repartidores propios del negocio y control de liquidación al final del turno.

---

## 3. Estructura de Archivos en el Monorepo

Los plugins se ubicarán en `packages/plugins/*` dentro del mismo repositorio:

```
Market/
├── apps/
│   ├── web/                         # Tienda Online (Storefront)
│   ├── admin/                       # Panel de Gestión del Comercio
│   └── super-admin/                 # Panel de Control del Dueño de la Plataforma
│
└── packages/
    ├── types/                       # Tipos TypeScript compartidos
    ├── database/                    # Cliente Supabase, servicios y esquemas
    ├── ui/                          # Componentes atómicos de diseño
    ├── utils/                       # Utilidades generales
    │
    └── plugins/                     # ◄─── Directorio de Plugins (Estilo Odoo Addons)
        │
        ├── food-service/            # Plugin de Gastronomía (Pulldog)
        │   ├── src/
        │   │   ├── types.ts         # RawMaterial, Recipe, ProductModifier
        │   │   ├── components/      # ModifierModal (Web), RecipeManager (Admin)
        │   │   ├── services/        # deductRecipeStock, getRawMaterials
        │   │   └── manifest.ts      # Metadatos del plugin
        │   ├── package.json
        │   └── index.ts
        │
        ├── barcode-retail/          # Plugin de Supermercados (Shop Market)
        │   ├── src/
        │   │   ├── components/      # BarcodeScanner, BulkExcelImporter
        │   │   └── services/        # parseExcelCatalog
        │   ├── package.json
        │   └── index.ts
        │
        └── local-venezuela/         # Plugin Venezuela
            ├── src/
            │   ├── payments/        # PagoMovilHandler, ZelleHandler
            │   ├── exchange/        # BcvSyncService
            │   └── fiscal/          # IgtfCalculator, TheFactoryHkaClient
            ├── package.json
            └── index.ts
```

---

## 4. Esquema de Base de Datos para Activación Dinámica

La activación de módulos por cliente se controla con una tabla relacional en PostgreSQL:

```sql
-- Tabla de Módulos / Plugins Habilitados por Inquilino
CREATE TABLE tenant_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL, -- 'food_service' | 'barcode_retail' | 'local_venezuela'
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}'::jsonb, -- Opciones específicas del plugin para este cliente
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, module_id)
);

-- Índice para consultas ultra-rápidas en caché
CREATE INDEX idx_tenant_modules_lookup ON tenant_modules(tenant_id, is_active);
```

### Ejemplo de Configuración en Base de Datos:

1. **Pulldog (Comida Rápida):**
   * `module_id = 'food_service'`, `is_active = true`
   * `module_id = 'local_venezuela'`, `is_active = true`
   * *(Resultado: Tiene menú con salsas, inventario de panes/salchichas y pago móvil).*

2. **Shop Market (Supermercado):**
   * `module_id = 'barcode_retail'`, `is_active = true`
   * `module_id = 'local_venezuela'`, `is_active = true`
   * *(Resultado: Tiene catálogo con código de barras, paginación masiva y pago móvil; NO ve recetas ni salsas).*

---

## 5. Guía para Futuros Desarrolladores y Colaboradores

Cuando un nuevo programador se una al proyecto, debe seguir estas **Reglas de Oro**:

1. **Nunca modifiques el Core para un caso particular:** Si un cliente pide una función especial, esa lógica debe vivir dentro de un plugin nuevo o existente en `packages/plugins/`.
2. **Usa siempre Soft Delete:** Ninguna eliminación debe ser destructiva (`DELETE`). Todas las tablas de plugins deben implementar la columna `deleted_at TIMESTAMPTZ NULL`.
3. **Aislamiento Multi-Tenant:** Toda consulta debe filtrar explícitamente por `tenant_id` y respetar las políticas de RLS de Supabase.
4. **Independencia de Plugins:** Un plugin de negocio (ej. `food-service`) no debe importar código de otro plugin de negocio (ej. `clothing-variants`). Ambos interactúan exclusivamente a través de las interfaces del Core.

---

## 6. Plan de Ejecución y Migración Paso a Paso

* [x] **Paso 1: Fundaciones en `@marketos/types`:** Definición de interfaces `TenantModule`, `PluginManifest`, `RawMaterial`, `ProductRecipe`, `ProductModifier`.
* [x] **Paso 2: Infraestructura en `@marketos/database`:** Migración de tablas `tenant_modules`, `raw_materials`, `recipes`, `product_modifiers` y métodos del repositorio.
* [x] **Paso 3: Creación de `packages/plugins/food-service`:** Componentes de gestión de insumos, escandallo, modales de salsas/extras y deducción de stock.
* [x] **Paso 4: Conexión de UI e Interruptores:** Modal de gestión de plugins en Super Admin (Opción 1), pestañas condicionales en Admin y modal de personalización en Storefront.
* [x] **Paso 5: Desacoplamiento de `packages/plugins/local-venezuela`:** Mover la lógica bancaria nacional (Pago Móvil, Zelle/Efectivo) y tasa BCV a su propio paquete modular desacoplado del core.
