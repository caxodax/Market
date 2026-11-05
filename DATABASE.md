# MarketOS — Diccionario de Datos y Especificación de Base de Datos

> **Gestor de Base de Datos**: PostgreSQL 15+ en Supabase  
> **Script Consolidado de Producción**: [`packages/database/supabase/PRODUCTION_FULL_SETUP.sql`](file:///home/lmontes/Documentos/Telegram/Market/packages/database/supabase/PRODUCTION_FULL_SETUP.sql)  
> **Migraciones Activas**: 30 migraciones secuenciales en [`packages/database/supabase/migrations/`](file:///home/lmontes/Documentos/Telegram/Market/packages/database/supabase/migrations)  
> **Aislamiento**: Row-Level Security (RLS) mandatorio en el 100% de las tablas.

---

## 1. Entidades del Núcleo (Core Multi-Tenant)

### `tenants`
Comercios que operan sobre la plataforma SaaS.
- **Campos**: `id` (TEXT, PK, e.g. `'shop-market-ca'`), `name` (TEXT), `slug` (TEXT, UNIQUE), `logo_url` (TEXT), `status` (TEXT: `'active' | 'inactive' | 'suspended' | 'trial'`), `custom_domain` (TEXT, UNIQUE), `created_at`, `updated_at`.
- **Aislamiento**: Base de segregación de todos los registros del sistema.

### `tenant_settings`
Configuración de marca, visual, monedas y canales de contacto del comercio.
- **Campos**: `tenant_id` (TEXT, PK -> `tenants.id`), `business_name` (TEXT), `category` (TEXT), `primary_color` (TEXT), `secondary_color` (TEXT), `accent_color` (TEXT), `logo_url` (TEXT), `banner_url` (TEXT), `phone` (TEXT), `email` (TEXT), `whatsapp_number` (TEXT), `address` (TEXT), `primary_currency` (TEXT DEFAULT `'USD'`), `secondary_currency` (TEXT DEFAULT `'VES'`), `supported_currencies` (TEXT[]), `default_currency` (TEXT), `social_links` (JSONB), `operational_settings` (JSONB).

### `stores`
Sedes físicas o sucursales del tenant.
- **Campos**: `id` (UUID, PK), `tenant_id` (TEXT -> `tenants.id`), `name` (TEXT), `code` (TEXT), `address` (TEXT), `phone` (TEXT), `is_active` (BOOLEAN).
- **Restricción**: `UNIQUE(tenant_id, code)`.

### `profiles`
Usuarios y empleados vinculados a un comercio o a la plataforma (fusionada con `auth.users`).
- **Campos**: `id` (UUID, PK -> `auth.users.id` ON DELETE CASCADE), `tenant_id` (TEXT -> `tenants.id`, NULL para Super Admin), `email` (TEXT), `full_name` (TEXT), `phone` (TEXT), `id_number` (TEXT: Cédula / RIF), `avatar_url` (TEXT), `role` (ENUM `app_role`: `'PLATFORM_SUPER_ADMIN' | 'TENANT_OWNER' | 'TENANT_MANAGER' | 'TENANT_INVENTORY' | 'TENANT_CASHIER' | 'TENANT_DELIVERY' | 'CUSTOMER'`).
- *Nota de limpieza*: La tabla redundante `user_profiles` fue deprecada y eliminada en la migración 00029.

### `customers`
Fichero de clientes recurrentes e invitados por comercio.
- **Campos**: `id` (UUID, PK), `tenant_id` (TEXT -> `tenants.id`), `name` (TEXT), `phone` (TEXT), `email` (TEXT), `address` (TEXT), `id_number` (TEXT).
- **Restricción de Integridad**: Índice único `idx_customers_tenant_phone` en `(tenant_id, phone)` para evitar duplicidad de registros en pedidos recurrentes.

---

## 2. Catálogo e Inventario Multi-Sede

### `categories`
Clasificación de productos del catálogo.
- **Campos**: `id` (UUID, PK), `tenant_id` (TEXT -> `tenants.id`), `name` (TEXT), `slug` (TEXT), `image_url` (TEXT), `sort_order` (INT), `is_active` (BOOLEAN).

### `products`
Fichas de productos vendibles en storefront y POS.
- **Campos**: `id` (UUID, PK), `tenant_id` (TEXT -> `tenants.id`), `category_id` (UUID -> `categories.id`), `name` (TEXT), `slug` (TEXT), `description` (TEXT), `price_usd` (NUMERIC(12,2) en divisa base), `cost_price` (NUMERIC(12,2), costo contable), `barcode` (TEXT, índice EAN-13), `sku` (TEXT), `image_url` (TEXT), `is_active` (BOOLEAN), `is_test` (BOOLEAN, Sandbox/Local), `is_tax_exempt` (BOOLEAN), `external_product_id` (TEXT), `metadata` (JSONB).

### `inventory`
Existencias en tiempo real por producto y sede física (soporta peso y fracciones).
- **Campos**: `id` (UUID, PK), `tenant_id` (TEXT -> `tenants.id`), `store_id` (UUID -> `stores.id`), `product_id` (UUID -> `products.id`), `quantity` (NUMERIC(12, 3)), `min_quantity` (NUMERIC(12, 3)), `aisle_location` (TEXT).
- **Restricción**: `UNIQUE(store_id, product_id)`.
- **Soporte Granel**: `NUMERIC(12, 3)` permite ventas al detalle fraccionales (ej. 0.350 kg de jamón o queso).

---

## 3. Ventas, Pagos y Despacho (Modelo Bimonetario Universal)

### `orders`
Cabecera de pedidos generados en vitrina web o en mostrador con arquitectura bimonetaria nativa.
- **Campos**: `id` (UUID, PK), `tenant_id` (TEXT -> `tenants.id`), `store_id` (UUID -> `stores.id`), `order_number` (TEXT, e.g. `'ORD-1042'`), `customer_name` (TEXT), `customer_phone` (TEXT), `customer_id_number` (TEXT), `customer_address` (TEXT), `delivery_type` (TEXT: `'pickup' | 'delivery'`), `delivery_zone_id` (UUID -> `delivery_zones.id`), `delivery_fee_usd` (NUMERIC(12,2)), `total_usd` (NUMERIC(12,2)), `total_ves` (NUMERIC(14,2)), `total_primary` (NUMERIC(12,2)), `total_secondary` (NUMERIC(14,2)), `exchange_rate_applied` (NUMERIC(14,4)), `is_test` (BOOLEAN, Sandbox/Local), `status` (TEXT: `'CREATED' | 'PAYMENT_PENDING' | 'PAYMENT_APPROVED' | 'PREPARING' | 'READY' | 'DELIVERING' | 'COMPLETED' | 'CANCELLED'`), `driver_id` (UUID -> `drivers.id`), `notes` (TEXT).

### `order_items`
Renglones de detalle de cada pedido.
- **Campos**: `id` (UUID, PK), `order_id` (UUID -> `orders.id` ON DELETE CASCADE), `product_id` (UUID -> `products.id`), `product_name` (TEXT), `quantity` (NUMERIC(12,3)), `unit_price` (NUMERIC(12,2)), `total_price` (NUMERIC(12,2)), `selected_modifiers` (JSONB).

### `payments`
Registro de comprobantes y validaciones de pago bimonetario.
- **Campos**: `id` (UUID, PK), `order_id` (UUID -> `orders.id`), `tenant_id` (TEXT -> `tenants.id`), `payment_method` (TEXT: `'pago_movil' | 'transfer' | 'zelle' | 'cash' | 'pos'`), `amount` (NUMERIC(12,2)), `currency` (TEXT), `reference_number` (TEXT), `proof_image_url` (TEXT en Cloudflare R2), `status` (TEXT: `'PENDING' | 'APPROVED' | 'REJECTED'`), `verified_by` (UUID -> `profiles.id`), `verified_at` (TIMESTAMPTZ).

### `exchange_rates` & `exchange_rate_history`
Control de tasas cambiarias oficiales sincronizadas desde BCV Today.
- **Campos**: `id` (UUID, PK), `tenant_id` (TEXT, NULL para global), `currency` (TEXT: `'VES'`), `value` (NUMERIC(14,4)), `source` (TEXT: `'bcv.today'`), `updated_at`.

---

## 4. Punto de Venta Mostrador (POS Registers & Dual Cash)

### `pos_registers`
Terminales o cajas físicas registradoras.
- **Campos**: `id` (UUID, PK), `tenant_id` (TEXT), `store_id` (UUID), `name` (TEXT), `code` (TEXT), `is_active` (BOOLEAN).

### `pos_shifts`
Turnos de cajero con apertura, cierre y arqueo ciego bimonetario segregado.
- **Campos**: `id` (UUID, PK), `tenant_id` (TEXT -> `tenants.id`), `register_id` (UUID -> `pos_registers.id`), `cashier_id` (UUID -> `profiles.id`), `opened_at` (TIMESTAMPTZ), `closed_at` (TIMESTAMPTZ), `opening_cash_primary` (NUMERIC(12,2)), `opening_cash_secondary` (NUMERIC(12,2)), `closing_cash_primary` (NUMERIC(12,2)), `closing_cash_secondary` (NUMERIC(12,2)), `expected_cash_primary` (NUMERIC(12,2)), `expected_cash_secondary` (NUMERIC(12,2)), `difference_primary` (NUMERIC(12,2)), `difference_secondary` (NUMERIC(12,2)), `status` (TEXT: `'OPEN' | 'CLOSED'`).

### `pos_cash_movements`
Entradas y salidas de efectivo durante el turno.
- **Campos**: `id` (UUID, PK), `shift_id` (UUID -> `pos_shifts.id`), `type` (TEXT: `'IN' | 'OUT'`), `amount` (NUMERIC), `currency` (TEXT), `reason` (TEXT), `performed_by` (UUID).

---

## 5. Módulos y Plugins Avanzados

### `tenant_modules`
Activación dinámica de plugins por comercio.
- **Campos**: `id` (UUID, PK), `tenant_id` (TEXT), `module_id` (TEXT: `'food_service' | 'mto_cpq' | 'storefront_pro' | 'local_venezuela' | 'invoicing' | 'accounting' | etc.`), `is_active` (BOOLEAN), `settings` (JSONB).
- **Restricción**: `UNIQUE(tenant_id, module_id)`.

### Gastronomía & Recetas (`food_service`)
- **`raw_materials`**: Insumos y materias primas (harina, queso, vasos, servilletas).
- **`recipes`**: Escandallo (BOM) que vincula un producto con sus cantidades de materia prima.
- **`product_modifier_groups` & `product_modifiers`**: Opciones de salsas, términos de cocción y extras de pago.

### Fabricación Bajo Pedido & Cotizador (`mto_cpq`)
- **`cpq_attribute_matrices`**: Factores multiplicadores por área ($m^2$), perímetro o complejidad.
- **`cpq_pricing_formulas`**: Reglas dinámicas de costeo de materiales, tintas y mano de obra.
- **`cpq_cost_settings`**: Costos fijos de plancha, corte láser y merma estimada.
- *Nota de limpieza*: Prototipos tempranos (`mto_quote_requests`, `mto_materials`) eliminados; el flujo oficial reside 100% en `cpq_*`.

### Facturación Fiscal & Secuencias Atómicas (`invoicing`)
- **`fiscal_documents`**: Facturas legales, notas de crédito/débito y guías de despacho.
- **`fiscal_sequences`**: Control atómico consecutivo con bloqueo `FOR UPDATE` para garantizar la correlatividad numérica legal sin saltos ni duplicados.

### Compras & Retenciones SENIAT (`purchasing_retentions`)
- **`purchase_invoices`**: Facturas de compra de proveedores.
- **`purchase_retentions`**: Comprobantes de retención de IVA (75% / 100%) y exportación TXT SENIAT.

### Contabilidad NIIF (`accounting`)
- **`accounting_accounts`**: Plan Único de Cuentas (PUC) de 4 niveles.
- **`journal_entries` & `journal_entry_lines`**: Asientos contables por partida doble.

### Taller de Sublimación, DTF & Artes Gráficas (`craft_workshop`) — Migración 00033
- **`craft_materials`**: Catálogo maestro de insumos por bulto/paquete (`pack_quantity`, `pack_price_base`, `unit_cost_base` GENERATED STORED).
- **`craft_recipes`**: Fichas de escandallo con costos directos, merma técnica (`waste_percentage`), mano de obra (`labor_cost_base`), margen (`margin_percentage`) y precios al detal y mayor.
- **`craft_recipe_items`**: Renglones relacionales de insumos utilizados en cada receta con snapshot de costos y `cost_used_base` GENERATED STORED.
- **`craft_quotes`**: Presupuestos para clientes y WhatsApp con cálculo automático del 50% de anticipo (`deposit_required_base`).

---

## 6. Procedimientos Almacenados y RPCs Transaccionales

PostgreSQL gestiona de manera autónoma las operaciones críticas que requieren consistencia ACID y alta velocidad de ejecución:

| Procedimiento Almacenado | Argumentos | Responsabilidad y Garantía ACID |
| :--- | :--- | :--- |
| **`rpc_create_order_atomic`** | `p_order_data JSONB` | Crea pedido, valida cupón de descuento con `FOR UPDATE`, detecta si el comercio es `food_service` (descarga recetas en gramos de `raw_materials`), `craft_workshop` (descarga insumos de `craft_materials`) o `retail` (descarga unidades/kilos de `inventory`), registra kardex en `inventory_movements` y confirma pedido. Realiza `ROLLBACK` total automático ante cualquier falta de stock. |
| **`rpc_recalculate_craft_recipes`** | `p_tenant_id TEXT, p_sync_storefront BOOLEAN` | Actualiza en bloque (< 5 ms) todos los snapshots de costos de recetas en `craft_recipe_items` y recalcula costos directos y precios de venta en `craft_recipes`. Si se activa `p_sync_storefront`, actualiza `price_usd` y `cost_price` en la tabla `products`. |
| **`rpc_issue_fiscal_document`** | `p_payload JSONB` | Adquiere bloqueo exclusivo con `FOR UPDATE` sobre `fiscal_sequences`, asigna el siguiente número consecutivo SENIAT, crea el documento en `fiscal_documents` y genera el asiento contable por partida doble balanceado ($\sum \text{Débito} = \sum \text{Crédito}$) en `journal_entries` / `journal_entry_lines`. |
| **`rpc_close_pos_shift`** | `p_payload JSONB` | Ejecuta el arqueo ciego de caja en PostgreSQL: suma todos los pagos en efectivo recibidos durante el turno en moneda principal y secundaria, calcula sobrantes o faltantes (`difference_primary`, `difference_secondary`) y sella el turno en `pos_shifts`. |
| **`rpc_get_sales_book`** | `p_tenant_id TEXT, p_year_month TEXT` | Agrega y formatea en milisegundos todo el Libro de Ventas mensual con base imponible, alícuotas IVA, exenciones, IGTF y retenciones para declaración tributaria ante el SENIAT. |

---

Para consultar la arquitectura global, patrones de diseño y flujo de datos, referirse a:
- [Documento Maestro de Arquitectura](file:///home/lmontes/Documentos/Telegram/Market/ARCHITECTURE.md)
- [Auditoría de Seguridad AgentShield](file:///home/lmontes/Documentos/Telegram/Market/AUDIT_AND_ROADMAP.md)
- [Bitácora de Actualizaciones](file:///home/lmontes/Documentos/Telegram/Market/ACTUALIZACION_2NOV2026.md)
