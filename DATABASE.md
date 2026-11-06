# MarketOS — Diccionario de Datos y Especificación de Base de Datos de la A a la Z

> **Gestor de Base de Datos**: PostgreSQL 15+ en Supabase  
> **Script Consolidado de Producción**: [`packages/database/supabase/PRODUCTION_FULL_SETUP.sql`](file:///home/lmontes/Documentos/Telegram/Market/packages/database/supabase/PRODUCTION_FULL_SETUP.sql)  
> **Migraciones Activas**: 33 migraciones secuenciales idempotentes en [`packages/database/supabase/migrations/`](file:///home/lmontes/Documentos/Telegram/Market/packages/database/supabase/migrations)  
> **Aislamiento**: Row-Level Security (RLS) mandatorio en el 100% de las tablas con políticas multi-tenant segregadas por `tenant_id`.  

---

## 📑 Índice del Diccionario

1. [Entidades del Núcleo (Core Multi-Tenant)](#1-entidades-del-núcleo-core-multi-tenant)
2. [Catálogo de Productos e Inventario Multi-Sede](#2-catálogo-de-productos-e-inventario-multi-sede)
3. [Ventas, Pagos y Motor Bimonetario Universal](#3-ventas-pagos-y-motor-bimonetario-universal)
4. [Punto de Venta Físico Mostrador (POS & Dual Cash)](#4-punto-de-venta-físico-mostrador-pos--dual-cash)
5. [Ecosistema de Tablas por Plugin](#5-ecosistema-de-tablas-por-plugin)
   - 5.1. [Taller de Sublimación & DTF (`craft_workshop`)](#51-taller-de-sublimación--dtf-craft_workshop)
   - 5.2. [Gastronomía & Recetas (`food_service`)](#52-gastronomía--recetas-food_service)
   - 5.3. [Fabricación Bajo Pedido (`mto_cpq`)](#53-fabricación-bajo-pedido-mto_cpq)
   - 5.4. [Facturación Fiscal SENIAT (`invoicing`)](#54-facturación-fiscal-seniat-invoicing)
   - 5.5. [Compras & Retenciones IVA (`purchasing_retentions`)](#55-compras--retenciones-iva-purchasing_retentions)
   - 5.6. [Contabilidad NIIF & PUC (`accounting`)](#56-contabilidad-niif--puc-accounting)
   - 5.7. [Retail & Balanzas Comerciales (`barcode_retail`)](#57-retail--balanzas-comerciales-barcode_retail)
   - 5.8. [Cupones y Promociones (`promotions_coupons`)](#58-cupones-y-promociones-promotions_coupons)
   - 5.9. [Flota de Repartidores (`delivery_fleet`)](#59-flota-de-repartidores-delivery_fleet)
   - 5.10. [Notificaciones Web Push (`push_notifications`)](#510-notificaciones-web-push-push_notifications)
   - 5.11. [Maquetador Visual (`storefront_pro`)](#511-maquetador-visual-storefront_pro)
   - 5.12. [Telemetría & Tráfico (`analytics`)](#512-telemetría--tráfico-analytics)
   - 5.13. [Auditoría Forense Inmutable (`audit_logs`)](#513-auditoría-forense-inmutable-audit_logs)
6. [Catálogo Cronológico de las 33 Migraciones SQL](#6-catálogo-cronológico-de-las-33-migraciones-sql)
7. [Procedimientos Almacenados y RPCs Transaccionales ACID](#7-procedimientos-almacenados-y-rpcs-transaccionales-acid)
8. [Políticas de Seguridad Row-Level Security (RLS)](#8-políticas-de-seguridad-row-level-security-rls)
9. [Estrategia de Indexación de Alto Rendimiento](#9-estrategia-de-indexación-de-alto-rendimiento)

---

## 1. Entidades del Núcleo (Core Multi-Tenant)

### `tenants`
Comercios que operan sobre la plataforma SaaS. Es la entidad raíz de segregación.
* `id` (`TEXT`, PK): Identificador canónico del inquilino (ej. `'shop-market-ca'`).
* `name` (`TEXT`, NOT NULL): Razón social o nombre comercial del negocio.
* `slug` (`TEXT`, UNIQUE, NOT NULL): Subdominio o slug de URL (ej. `'shop-market'`).
* `logo_url` (`TEXT`): URL del imagotipo en Cloudflare R2 o Supabase Storage.
* `status` (`TEXT`, NOT NULL): Estado operativo: `'active' | 'inactive' | 'suspended' | 'trial'`.
* `custom_domain` (`TEXT`, UNIQUE): Dominio propio mapeado vía CNAME (ej. `'pedidos.mimercado.com'`).
* `created_at` (`TIMESTAMPTZ`, DEFAULT `now()`).
* `updated_at` (`TIMESTAMPTZ`, DEFAULT `now()`).

### `tenant_settings`
Configuración de identidad visual, parámetros comerciales y monedas del comercio.
* `tenant_id` (`TEXT`, PK, FK -> `tenants.id` ON DELETE CASCADE).
* `business_name` (`TEXT`, NOT NULL): Nombre visible en tickets y vitrina.
* `category` (`TEXT`): Giro comercial principal (ej. `'Supermercado'`, `'Gastronomía'`).
* `primary_color` (`TEXT`, DEFAULT `'#DC2626'`): Color primario corporativo en formato HEX.
* `secondary_color` (`TEXT`, DEFAULT `'#09090B'`): Color secundario o de fondo.
* `accent_color` (`TEXT`, DEFAULT `'#FFFFFF'`): Color de contraste para textos y botones.
* `font_family` (`TEXT`, DEFAULT `'Plus Jakarta Sans'`): Tipografía seleccionada.
* `logo_url` (`TEXT`), `banner_url` (`TEXT`): Portadas y cabeceras gráficas.
* `phone` (`TEXT`), `email` (`TEXT`), `whatsapp_number` (`TEXT`, NOT NULL).
* `address` (`TEXT`): Dirección fiscal y operativa principal.
* `primary_currency` (`TEXT`, DEFAULT `'USD'`): Moneda de costeo y catálogo base.
* `secondary_currency` (`TEXT`, DEFAULT `'VES'`): Moneda de curso legal alternativa.
* `supported_currencies` (`TEXT[]`, DEFAULT `ARRAY['USD', 'VES']`): Monedas habilitadas en checkout.
* `default_currency` (`TEXT`, DEFAULT `'USD'`): Moneda seleccionada por defecto al entrar el cliente.
* `social_links` (`JSONB`): Enlaces a redes sociales (`instagram`, `facebook`, `tiktok`).
* `payment_settings` (`JSONB`): Cuentas bancarias, teléfonos de Pago Móvil y correos Zelle.
* `operational_settings` (`JSONB`): Horarios de atención, pedido mínimo y aviso de cierre.
* `billing_settings` (`JSONB`): Parámetros fiscales SENIAT, RIF y modo de facturación.
* `custom_domain` (`TEXT`): Dominio personalizado alternativo.

### `stores`
Sedes físicas, depósitos o sucursales del tenant.
* `id` (`UUID`, PK, DEFAULT `gen_random_uuid()`).
* `tenant_id` (`TEXT`, NOT NULL, FK -> `tenants.id` ON DELETE CASCADE).
* `name` (`TEXT`, NOT NULL): Nombre de la sede (ej. `'Sede Nueva Segovia'`).
* `code` (`TEXT`, NOT NULL): Código alfanumérico corto (ej. `'NS-01'`).
* `address` (`TEXT`): Dirección física de la sucursal.
* `phone` (`TEXT`): Teléfono de atención de la sede.
* `is_active` (`BOOLEAN`, DEFAULT `true`).
* **Restricción de Integridad**: `UNIQUE(tenant_id, code)`.

### `profiles`
Usuarios y empleados vinculados al comercio o a la plataforma administrativa.
* `id` (`UUID`, PK, FK -> `auth.users.id` ON DELETE CASCADE).
* `tenant_id` (`TEXT`, FK -> `tenants.id` ON DELETE CASCADE, NULL para Super Administradores).
* `email` (`TEXT`, NOT NULL, UNIQUE): Correo corporativo del empleado.
* `full_name` (`TEXT`, NOT NULL): Nombre y apellido del usuario.
* `phone` (`TEXT`): Teléfono de contacto.
* `id_number` (`TEXT`): Cédula de identidad o RIF personal.
* `avatar_url` (`TEXT`): Foto de perfil.
* `role` (`app_role`, NOT NULL, DEFAULT `'CUSTOMER'`):
  - `'PLATFORM_SUPER_ADMIN'`: Acceso total multi-tenant a `/platform`.
  - `'TENANT_OWNER'`: Dueño del comercio con control total de `/admin`.
  - `'TENANT_MANAGER'`: Administrador operativo con acceso a ventas y catálogo.
  - `'TENANT_INVENTORY'`: Operador de almacén y materias primas.
  - `'TENANT_CASHIER'`: Operador de cajas registradoras POS.
  - `'TENANT_DELIVERY'`: Motorizado asignado al despacho.
  - `'CUSTOMER'`: Cliente final de la tienda web.
* `created_at` (`TIMESTAMPTZ`, DEFAULT `now()`).
* `updated_at` (`TIMESTAMPTZ`, DEFAULT `now()`).

### `customers`
Fichero de clientes recurrentes e invitados por comercio.
* `id` (`UUID`, PK, DEFAULT `gen_random_uuid()`).
* `tenant_id` (`TEXT`, NOT NULL, FK -> `tenants.id` ON DELETE CASCADE).
* `name` (`TEXT`, NOT NULL): Nombre del cliente.
* `phone` (`TEXT`, NOT NULL): Teléfono móvil formateado para WhatsApp.
* `email` (`TEXT`): Correo electrónico del cliente.
* `address` (`TEXT`): Dirección de entrega habitual.
* `id_number` (`TEXT`): Cédula o RIF para emisión de comprobantes fiscales.
* `created_at` (`TIMESTAMPTZ`, DEFAULT `now()`).
* **Índice Único**: `UNIQUE(tenant_id, phone)` para consolidar el historial del cliente en compras sucesivas.

---

## 2. Catálogo de Productos e Inventario Multi-Sede

### `categories`
Clasificación temática de productos.
* `id` (`UUID`, PK, DEFAULT `gen_random_uuid()`).
* `tenant_id` (`TEXT`, NOT NULL, FK -> `tenants.id` ON DELETE CASCADE).
* `name` (`TEXT`, NOT NULL): Nombre de la categoría (ej. `'Víveres'`, `'Bebidas'`).
* `slug` (`TEXT`, NOT NULL): Slug URL amigable.
* `image_url` (`TEXT`): Ícono o imagen representativa.
* `sort_order` (`INT`, DEFAULT `0`): Posición en el menú visual.
* `is_active` (`BOOLEAN`, DEFAULT `true`).
* **Restricción**: `UNIQUE(tenant_id, slug)`.

### `products`
Fichas maestras de productos vendibles en vitrina digital y cajas POS.
* `id` (`UUID`, PK, DEFAULT `gen_random_uuid()`).
* `tenant_id` (`TEXT`, NOT NULL, FK -> `tenants.id` ON DELETE CASCADE).
* `category_id` (`UUID`, FK -> `categories.id` ON DELETE SET NULL).
* `name` (`TEXT`, NOT NULL): Título del producto.
* `slug` (`TEXT`, NOT NULL): Slug de URL del producto.
* `description` (`TEXT`): Descripción detallada comercial.
* `price_usd` (`NUMERIC(12,2)`, NOT NULL): Precio base en la divisa de referencia (USD).
* `cost_price` (`NUMERIC(12,2)`, DEFAULT `0.00`): Costo unitario para cálculo de margen bruto.
* `barcode` (`TEXT`): Código de barras principal (EAN-13, UPC o Code-128).
* `sku` (`TEXT`): Código interno de referencia de almacén.
* `image_url` (`TEXT`): Fotografía principal en Cloudflare R2.
* `is_active` (`BOOLEAN`, DEFAULT `true`): Visibilidad en vitrina y POS.
* `is_test` (`BOOLEAN`, DEFAULT `false`): Bandera para pruebas Sandbox locales sin afectar balances reales.
* `is_tax_exempt` (`BOOLEAN`, DEFAULT `false`): Si está exento de IVA (Art. 18 Ley del IVA).
* `external_product_id` (`TEXT`): Identificador para sincronizaciones con WooCommerce / ERPs externos.
* `metadata` (`JSONB`, DEFAULT `'{}'::jsonb`): Propiedades dinámicas adicionales.
* `created_at` (`TIMESTAMPTZ`, DEFAULT `now()`).
* `updated_at` (`TIMESTAMPTZ`, DEFAULT `now()`).
* **Restricción**: `UNIQUE(tenant_id, slug)`.

### `inventory`
Existencias en tiempo real por producto y sede física (soporta ventas por peso fraccionario).
* `id` (`UUID`, PK, DEFAULT `gen_random_uuid()`).
* `tenant_id` (`TEXT`, NOT NULL, FK -> `tenants.id` ON DELETE CASCADE).
* `store_id` (`UUID`, NOT NULL, FK -> `stores.id` ON DELETE CASCADE).
* `product_id` (`UUID`, NOT NULL, FK -> `products.id` ON DELETE CASCADE).
* `quantity` (`NUMERIC(12, 3)`, NOT NULL, DEFAULT `0.000`): Stock físico disponible. Soporta 3 decimales para gramajes (ej. 1.250 kg).
* `min_quantity` (`NUMERIC(12, 3)`, DEFAULT `5.000`): Umbral mínimo para alertas de reabastecimiento.
* `aisle_location` (`TEXT`): Ubicación física (Pasillo, Estante, Gaveta).
* `updated_at` (`TIMESTAMPTZ`, DEFAULT `now()`).
* **Restricción**: `UNIQUE(store_id, product_id)`.

### `inventory_movements`
Kardex inmutable de entradas, salidas y ajustes de mercancía.
* `id` (`UUID`, PK, DEFAULT `gen_random_uuid()`).
* `tenant_id` (`TEXT`, NOT NULL, FK -> `tenants.id` ON DELETE CASCADE).
* `store_id` (`UUID`, NOT NULL, FK -> `stores.id`).
* `product_id` (`UUID`, NOT NULL, FK -> `products.id`).
* `type` (`TEXT`, NOT NULL): `'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'WASTE'`.
* `quantity_delta` (`NUMERIC(12, 3)`, NOT NULL): Cantidad sumada o restada.
* `previous_quantity` (`NUMERIC(12, 3)`, NOT NULL): Existencia anterior al movimiento.
* `new_quantity` (`NUMERIC(12, 3)`, NOT NULL): Existencia resultante tras el movimiento.
* `reference_id` (`TEXT`): Número de orden, compra o ajuste vinculado.
* `performed_by` (`UUID`, FK -> `profiles.id`).
* `created_at` (`TIMESTAMPTZ`, DEFAULT `now()`).

---

## 3. Ventas, Pagos y Motor Bimonetario Universal

### `orders`
Cabecera de pedidos generados en vitrina web o cajas de mostrador.
* `id` (`UUID`, PK, DEFAULT `gen_random_uuid()`).
* `tenant_id` (`TEXT`, NOT NULL, FK -> `tenants.id` ON DELETE CASCADE).
* `store_id` (`UUID`, FK -> `stores.id`).
* `order_number` (`TEXT`, NOT NULL): Número único correlativo legible (ej. `'ORD-1042'`).
* `customer_name` (`TEXT`, NOT NULL): Nombre del comprador.
* `customer_phone` (`TEXT`, NOT NULL): Teléfono de contacto.
* `customer_id_number` (`TEXT`): Cédula o RIF para identificación fiscal.
* `delivery_address` (`TEXT`): Dirección de entrega o indicaciones especiales.
* `delivery_type` (`TEXT`, NOT NULL, DEFAULT `'pickup'`): `'pickup' | 'delivery'`.
* `delivery_zone_id` (`UUID`, FK -> `delivery_zones.id`).
* `delivery_fee_usd` (`NUMERIC(12,2)`, DEFAULT `0.00`): Tarifa de envío.
* `total_usd` (`NUMERIC(12,2)`, NOT NULL): Monto total en divisa de referencia (USD).
* `total_ves` (`NUMERIC(14,2)`, NOT NULL): Monto total en bolívares (VES) a la tasa BCV aplicada.
* `total_primary` (`NUMERIC(12,2)`), `total_secondary` (`NUMERIC(14,2)`): Totales bimonetarios canónicos.
* `exchange_rate_applied` (`NUMERIC(14,4)`, NOT NULL): Tasa cambiaria oficial congelada al momento de la compra.
* `status` (`TEXT`, NOT NULL, DEFAULT `'CREATED'`):
  - `'CREATED'`: Pedido registrado por el cliente, en espera de pago.
  - `'PAYMENT_PENDING'`: Comprobante de pago subido, en espera de validación bancaria.
  - `'PAYMENT_APPROVED'`: Pago verificado y confirmado.
  - `'PREPARING'`: En preparación en cocina (KDS), taller (Craft) o picking de almacén.
  - `'READY'`: Listo para ser retirado o despachado con chofer.
  - `'DELIVERING'`: En tránsito con motorizado asignado.
  - `'COMPLETED'`: Entregado satisfactoriamente al cliente.
  - `'CANCELLED'`: Anulado por rechazo de pago o falta de stock.
* `payment_status` (`TEXT`, DEFAULT `'PENDING'`): `'PENDING' | 'APPROVED' | 'REJECTED'`.
* `driver_id` (`UUID`, FK -> `drivers.id`).
* `is_test` (`BOOLEAN`, DEFAULT `false`): Marca de pedido de prueba.
* `notes` (`TEXT`): Comentarios o solicitudes del cliente.
* `created_at` (`TIMESTAMPTZ`, DEFAULT `now()`).
* `updated_at` (`TIMESTAMPTZ`, DEFAULT `now()`).
* **Restricción**: `UNIQUE(tenant_id, order_number)`.

### `order_items`
Renglones de detalle de cada pedido.
* `id` (`UUID`, PK, DEFAULT `gen_random_uuid()`).
* `order_id` (`UUID`, NOT NULL, FK -> `orders.id` ON DELETE CASCADE).
* `product_id` (`UUID`, NOT NULL, FK -> `products.id`).
* `product_name` (`TEXT`, NOT NULL): Nombre del producto al momento de la venta.
* `quantity` (`NUMERIC(12,3)`, NOT NULL): Unidades o kilos adquiridos.
* `unit_price` (`NUMERIC(12,2)`, NOT NULL): Precio unitario en USD cobrado.
* `total_price` (`NUMERIC(12,2)`, NOT NULL): Total del renglón (`quantity * unit_price`).
* `selected_modifiers` (`JSONB`, DEFAULT `'[]'::jsonb`): Opciones gastronómicas o acabados de taller seleccionados.

### `payments`
Comprobantes bancarios y validaciones de pago bimonetario.
* `id` (`UUID`, PK, DEFAULT `gen_random_uuid()`).
* `tenant_id` (`TEXT`, NOT NULL, FK -> `tenants.id` ON DELETE CASCADE).
* `order_id` (`UUID`, NOT NULL, FK -> `orders.id` ON DELETE CASCADE).
* `payment_method` (`TEXT`, NOT NULL): `'pago_movil' | 'transfer' | 'zelle' | 'cash_usd' | 'cash_ves' | 'pos'`.
* `amount` (`NUMERIC(12,2)`, NOT NULL): Importe abonado.
* `currency` (`TEXT`, NOT NULL): Moneda del pago (`'USD' | 'VES'`).
* `reference_number` (`TEXT`): Número de referencia bancaria o número de confirmación.
* `proof_image_url` (`TEXT`): Foto de la captura de pantalla del pago en Cloudflare R2.
* `status` (`TEXT`, NOT NULL, DEFAULT `'PENDING'`): `'PENDING' | 'APPROVED' | 'REJECTED'`.
* `verified_by` (`UUID`, FK -> `profiles.id`): Usuario que concilió el pago.
* `verified_at` (`TIMESTAMPTZ`): Momento exacto de la confirmación.
* `created_at` (`TIMESTAMPTZ`, DEFAULT `now()`).

### `exchange_rates` & `exchange_rate_history`
Registro de tasas oficiales del Banco Central de Venezuela.
* **`exchange_rates`**: Registro activo en tiempo real (`id`, `tenant_id`, `currency`, `value`, `source`, `updated_at`).
* **`exchange_rate_history`**: Registro histórico inmutable de tasas por fecha (`id`, `currency`, `rate`, `effective_date`, `created_at`) para cierres contables y auditorías del SENIAT.

---

## 4. Punto de Venta Físico Mostrador (POS & Dual Cash)

### `pos_registers`
Terminales físicas o cajas registradoras.
* `id` (`UUID`, PK, DEFAULT `gen_random_uuid()`).
* `tenant_id` (`TEXT`, NOT NULL, FK -> `tenants.id` ON DELETE CASCADE).
* `store_id` (`UUID`, NOT NULL, FK -> `stores.id`).
* `name` (`TEXT`, NOT NULL): Nombre de la caja (ej. `'Caja 1 - Principal'`).
* `code` (`TEXT`, NOT NULL): Código de la terminal (ej. `'POS-01'`).
* `is_active` (`BOOLEAN`, DEFAULT `true`).
* **Restricción**: `UNIQUE(store_id, code)`.

### `pos_shifts`
Turnos de cajero con apertura, cierre y arqueo ciego bimonetario.
* `id` (`UUID`, PK, DEFAULT `gen_random_uuid()`).
* `tenant_id` (`TEXT`, NOT NULL, FK -> `tenants.id` ON DELETE CASCADE).
* `register_id` (`UUID`, NOT NULL, FK -> `pos_registers.id`).
* `cashier_id` (`UUID`, NOT NULL, FK -> `profiles.id`).
* `opened_at` (`TIMESTAMPTZ`, DEFAULT `now()`).
* `closed_at` (`TIMESTAMPTZ`): Momento del cierre del turno.
* `opening_cash_primary` (`NUMERIC(12,2)`, NOT NULL): Fondo de caja inicial en USD.
* `opening_cash_secondary` (`NUMERIC(12,2)`, NOT NULL): Fondo de caja inicial en VES.
* `closing_cash_primary` (`NUMERIC(12,2)`), `closing_cash_secondary` (`NUMERIC(12,2)`): Efectivo contado por el cajero al cerrar (arqueo ciego).
* `expected_cash_primary` (`NUMERIC(12,2)`), `expected_cash_secondary` (`NUMERIC(12,2)`): Efectivo calculado por el sistema según ventas y movimientos.
* `difference_primary` (`NUMERIC(12,2)`), `difference_secondary` (`NUMERIC(12,2)`): Diferencia (sobrante o faltante de dinero).
* `status` (`TEXT`, NOT NULL, DEFAULT `'OPEN'`): `'OPEN' | 'CLOSED'`.

### `pos_cash_movements`
Entradas y salidas manuales de efectivo durante el turno.
* `id` (`UUID`, PK, DEFAULT `gen_random_uuid()`).
* `shift_id` (`UUID`, NOT NULL, FK -> `pos_shifts.id` ON DELETE CASCADE).
* `type` (`TEXT`, NOT NULL): `'IN'` (Ingreso de cambio/fondo) | `'OUT'` (Pago a proveedor/retiro de seguridad).
* `amount` (`NUMERIC(12,2)`, NOT NULL): Monto del movimiento.
* `currency` (`TEXT`, NOT NULL): `'USD' | 'VES'`.
* `reason` (`TEXT`, NOT NULL): Motivo o justificación del movimiento.
* `performed_by` (`UUID`, NOT NULL, FK -> `profiles.id`).
* `created_at` (`TIMESTAMPTZ`, DEFAULT `now()`).

---

## 5. Ecosistema de Tablas por Plugin

### 5.1. Taller de Sublimación & DTF (`craft_workshop`)
Migración `00033_craft_workshop_plugin.sql`. Control de insumos por paquete, escandallo de fórmulas y presupuestos con anticipo:
* **`craft_materials`**:
  * `id` (`UUID`, PK), `tenant_id` (`TEXT`), `name` (`TEXT`), `category` (`TEXT`: `'TEXTILE' | 'CERAMIC' | 'PAPER_VINYL' | 'INK_CONSUMABLE' | 'PACKAGING' | 'HARDWARE'`), `unit` (`TEXT`: `'UNIT' | 'SHEET' | 'METER' | 'ML' | 'GRAM'`), `pack_quantity` (`NUMERIC(12,3)`), `pack_price_base` (`NUMERIC(12,2)`), `unit_cost_base` (`NUMERIC(14,4)` GENERATED ALWAYS AS (`pack_price_base / pack_quantity`) STORED), `current_stock_units` (`NUMERIC(12,3)`), `min_stock_units` (`NUMERIC(12,3)`).
* **`craft_recipes`**:
  * `id` (`UUID`, PK), `tenant_id` (`TEXT`), `product_id` (`UUID` FK -> `products.id`), `name` (`TEXT`), `technique` (`TEXT`: `'SUBLIMATION' | 'DTF' | 'VINYL' | 'SERIGRAPHY' | 'LASER' | 'EMBROIDERY'`), `waste_percentage` (`NUMERIC(5,2)`), `labor_cost_base` (`NUMERIC(12,2)`), `margin_percentage` (`NUMERIC(5,2)`), `direct_cost_base` (`NUMERIC(12,2)`), `sale_price_retail_base` (`NUMERIC(12,2)`), `sale_price_wholesale_base` (`NUMERIC(12,2)`).
* **`craft_recipe_items`**:
  * `id` (`UUID`, PK), `recipe_id` (`UUID` FK -> `craft_recipes.id`), `material_id` (`UUID` FK -> `craft_materials.id`), `quantity_needed` (`NUMERIC(12,3)`), `snapshot_unit_cost_base` (`NUMERIC(14,4)`), `cost_used_base` (`NUMERIC(12,2)` GENERATED ALWAYS AS (`quantity_needed * snapshot_unit_cost_base`) STORED).
* **`craft_quotes`**:
  * `id` (`UUID`, PK), `tenant_id` (`TEXT`), `quote_number` (`TEXT`), `customer_name` (`TEXT`), `customer_phone` (`TEXT`), `total_base` (`NUMERIC(12,2)`), `deposit_required_base` (`NUMERIC(12,2)`), `deposit_paid_base` (`NUMERIC(12,2)`), `status` (`TEXT`: `'DRAFT' | 'SENT' | 'APPROVED' | 'IN_PRODUCTION' | 'DELIVERED' | 'CANCELLED'`).

### 5.2. Gastronomía & Recetas (`food_service`)
* **`raw_materials`**: Insumos de cocina (harina, queso, salchichas, carne, vasos, servilletas).
* **`recipes`**: Escandallo (BOM) que vincula un plato con sus materias primas en gramos/mililitros.
* **`product_modifier_groups` & `product_modifiers`**: Términos de cocción, tipo de pan, salsas y extras con sobreprecio.

### 5.3. Fabricación Bajo Pedido (`mto_cpq`)
* **`cpq_attribute_matrices`**: Factores multiplicadores dimensionales por área ($m^2$), perímetro o complejidad.
* **`cpq_pricing_formulas`**: Reglas dinámicas de costeo de materiales, tintas y horas de máquina.
* **`cpq_cost_settings`**: Costos de puesta a punto de plancha, corte y margen de taller.

### 5.4. Facturación Fiscal SENIAT (`invoicing`)
* **`fiscal_documents`**: Facturas legales, notas de crédito, notas de débito y guías de despacho.
* **`fiscal_document_items`**: Renglones con base imponible, alícuotas IVA (16%, 8%, 0%) e IGTF (3%).
* **`fiscal_sequences`**: Control de numeración secuencial atómica consecutiva con bloqueo `FOR UPDATE`.

### 5.5. Compras & Retenciones IVA (`purchasing_retentions`)
* **`purchase_invoices`**: Facturas de compra emitidas por proveedores.
* **`purchase_retentions`**: Comprobantes de retención de IVA (75% / 100%) y generación del archivo TXT para declaración ante el portal SENIAT.

### 5.6. Contabilidad NIIF & PUC (`accounting`)
* **`accounting_accounts`**: Plan Único de Cuentas (PUC) de 4 niveles (Activo, Pasivo, Patrimonio, Ingresos, Costos, Gastos).
* **`journal_entries` & `journal_entry_lines`**: Asientos contables automáticos por partida doble balanceada ($\sum \text{Débito} = \sum \text{Crédito}$).

### 5.7. Retail & Balanzas Comerciales (`barcode_retail`)
* **`product_barcodes`**: Soporte para múltiples códigos de barra por producto (unidad, pack de 6, bulto de 24).
* **Balanzas comerciales**: Parser para códigos de barra de balanza de carnicería/charcutería (`20XXXXXWWWWWC` donde se incrusta el peso o el precio).

### 5.8. Cupones y Promociones (`promotions_coupons`)
* **`coupons`**: Cupones de descuento fijo o porcentual con límite de usos, fecha de vencimiento y monto mínimo de compra.
* **`coupon_usages`**: Registro de clientes que han canjeado un cupón para evitar doble uso.

### 5.9. Flota de Repartidores (`delivery_fleet`)
* **`delivery_zones`**: Polígonos y tarifas de envío por sector urbano o distancia en kilómetros.
* **`drivers`**: Fichero de motorizados con placa de vehículo, teléfono y estado activo.

### 5.10. Notificaciones Web Push (`push_notifications`)
* **`push_subscriptions`**: Suscripciones Web Push estándar W3C/VAPID de clientes y empleados.
* **`push_notification_logs`**: Registro histórico de campañas de marketing y alertas enviadas.

### 5.11. Maquetador Visual (`storefront_pro`)
* **`storefront_blocks`**: Configuración de los 11 bloques dinámicos ordenables de la vitrina digital (Hero Slider, Reels, Flash Sale, Testimonios, Marcas, FAQ, etc.).

### 5.12. Telemetría & Tráfico (`analytics`)
* **`tenant_page_views`**: Visitas a productos, fuentes de referencia (Instagram, TikTok, WhatsApp) y tasa de conversión de checkout.

### 5.13. Auditoría Forense Inmutable (`audit_logs`)
* **`audit_logs`**: Trazabilidad completa con `tenant_id`, `user_id`, `action`, `resource_type`, `resource_id`, `ip_address`, `user_agent` y `payload` JSONB de cambios antes y después de cada mutación.

---

## 6. Catálogo Cronológico de las 33 Migraciones SQL

| N° | Archivo de Migración | Propósito y Cambios en el Modelo |
| :---: | :--- | :--- |
| **00001** | `00001_initial_schema.sql` | Estructura base: `tenants`, `tenant_settings`, `stores`, `profiles`, `categories`, `products`, `inventory`, `orders`, `order_items`, `payments`, `audit_logs`. |
| **00002** | `00002_seed_shop_market.sql` | Inserción de datos semilla del primer comercio piloto (Shop Market C.A., Barquisimeto). |
| **00003** | `00003_phase_2_operational.sql` | Tablas de operaciones: `coupons`, `delivery_zones`, `drivers`. |
| **00004** | `00004_phase_3_saas_multi_tenant.sql` | Modelo SaaS: Planes de suscripción, cuotas de productos y límites de tiendas. |
| **00005** | `00005_phase_4_production_hardening.sql` | Triggers automáticos para mantenimiento de columnas `updated_at`. |
| **00006** | `00006_auth_roles_profiles.sql` | Definición de roles RBAC (`app_role`) y sincronización con `auth.users`. |
| **00007** | `00007_supabase_cron_bcv_sync.sql` | Configuración de extensiones `pg_cron` y `pg_net` para sincronizar la tasa BCV diaria vía API. |
| **00008** | `00008_exchange_rate_history.sql` | Tabla `exchange_rate_history` para auditoría y congelación de tasas en cierres fiscales. |
| **00009** | `00009_tenant_brand_and_payment_settings.sql` | Configuración de pasarelas bimonetarias (Pago Móvil, Zelle, Transferencia, Efectivo). |
| **00010** | `00010_push_notifications.sql` | Suscripciones VAPID (`push_subscriptions`) y campañas masivas PWA. |
| **00011** | `00011_customer_id_number_ci_rif.sql` | Columna `id_number` (Cédula / RIF) en clientes y colaboradores. |
| **00012** | `00012_fiscal_billing_settings.sql` | Configuración de alícuotas IVA, cálculo del 3% IGTF y datos fiscales de emisor. |
| **00013** | `00013_custom_domains.sql` | Mapeo de dominios personalizados en la tabla `tenants` con índice único. |
| **00014** | `00014_global_audit_trail_hardening.sql` | Fortalecimiento del registro forense con dirección IP y User-Agent. |
| **00015** | `00015_tenant_modules_and_food_service.sql` | Sistema de módulos (`tenant_modules`) y tablas de cocina (`raw_materials`, `recipes`, `product_modifiers`). |
| **00016** | `00016_platform_settings.sql` | Parámetros globales de la plataforma administrables por el Super Admin. |
| **00017** | `00017_mto_cpq_engine.sql` | Motor Make-to-Order: Matrices de atributos dimensionales y cotizadores de taller. |
| **00018** | `00018_storefront_pro.sql` | Maquetador de vitrina digital con 11 tipos de bloques dinámicos (`storefront_blocks`). |
| **00019** | `00019_tenant_performance_indexes.sql` | Índices compuestos B-Tree y GIN para acelerar búsquedas y consultas frecuentes (<10 ms). |
| **00020** | `00020_barcode_retail_engine.sql` | Retail de alta velocidad: Códigos EAN-13, pasillos y embalajes mayoristas. |
| **00021** | `00021_cpq_configurable_deposit.sql` | Parámetro de anticipo porcentual configurable para cotizaciones CPQ. |
| **00022** | `00022_food_service_kitchen_hardening.sql` | Pantalla de cocina KDS en tiempo real con comandas y estados de cocción. |
| **00023** | `00023_pos_registers.sql` | Cajas registradoras físicas: `pos_registers`, `pos_shifts` y arqueo ciego bimonetario. |
| **00024** | `00024_tenant_analytics.sql` | Telemetría de negocio: Visualizaciones de página, fuentes de tráfico y embudos. |
| **00025** | `00025_fiscal_documents.sql` | Documentos fiscales legales SENIAT (`fiscal_documents`) y Libro de Ventas. |
| **00026** | `00026_purchasing_and_retentions.sql` | Facturas de compra de proveedores y comprobantes de retención de IVA (75% y 100%). |
| **00027** | `00027_accounting_and_commissions.sql` | Contabilidad NIIF: Plan Único de Cuentas (PUC 4 niveles) y asientos por partida doble. |
| **00028** | `00028_atomic_fiscal_sequences.sql` | Control estricto de correlativos consecutivos legales con bloqueo `FOR UPDATE`. |
| **00029** | `00029_schema_cleanup_and_bimonetary.sql` | Eliminación de tablas redundantes muertas, pesaje fraccionario (`NUMERIC(12,3)`) y balance dual en caja. |
| **00030** | `00030_core_transactional_rpcs.sql` | Funciones almacenadas transaccionales ACID (`rpc_create_order_atomic`, `rpc_issue_fiscal_document`, `rpc_close_pos_shift`, `rpc_get_sales_book`). |
| **00031** | `00031_profiles_email_unique.sql` | Índice único sobre `email` en la tabla `profiles` para evitar duplicidad de colaboradores. |
| **00032** | `00032_fix_profiles_rls_recursion.sql` | Corrección de bucles de recursión infinita en las políticas de seguridad de la tabla `profiles`. |
| **00033** | `00033_craft_workshop_plugin.sql` | Taller de sublimación y DTF: Insumos por paquete (`craft_materials`), recetas con merma y mano de obra (`craft_recipes`), presupuestos (`craft_quotes`) y función `rpc_recalculate_craft_recipes`. |

---

## 7. Procedimientos Almacenados y RPCs Transaccionales ACID

PostgreSQL gestiona de manera autónoma las operaciones críticas que requieren consistencia ACID y alta velocidad de ejecución:

| Procedimiento Almacenado | Argumentos | Responsabilidad y Garantía ACID |
| :--- | :--- | :--- |
| **`rpc_create_order_atomic`** | `p_order_data JSONB` | Crea el pedido, valida cupones de descuento con `FOR UPDATE`, detecta el giro del negocio (`food_service`, `craft_workshop` o `retail`), descuenta materias primas o stock físico, registra kardex en `inventory_movements` y confirma la orden. Si no hay stock suficiente, ejecuta un `ROLLBACK` total automático evitando pedidos huérfanos. |
| **`rpc_recalculate_craft_recipes`** | `p_tenant_id TEXT, p_sync_storefront BOOLEAN` | Actualiza en bloque (< 5 ms) todos los snapshots de costos de recetas en `craft_recipe_items` y recalcula costos directos y precios de venta en `craft_recipes`. Si se activa `p_sync_storefront`, sincroniza `price_usd` y `cost_price` en la tabla `products`. |
| **`rpc_issue_fiscal_document`** | `p_payload JSONB` | Adquiere bloqueo exclusivo con `FOR UPDATE` sobre `fiscal_sequences`, asigna el siguiente número consecutivo legal SENIAT sin saltos ni duplicados, crea el documento en `fiscal_documents` y genera el asiento contable por partida doble balanceado ($\sum \text{Débito} = \sum \text{Crédito}$) en `journal_entries`. |
| **`rpc_close_pos_shift`** | `p_payload JSONB` | Ejecuta el arqueo ciego de caja en PostgreSQL: suma todos los pagos en efectivo recibidos durante el turno en moneda principal y secundaria, calcula sobrantes o faltantes (`difference_primary`, `difference_secondary`) y sella el turno en `pos_shifts`. |
| **`rpc_get_sales_book`** | `p_tenant_id TEXT, p_year_month TEXT` | Agrega y formatea en milisegundos todo el Libro de Ventas mensual con base imponible, alícuotas IVA, exenciones, IGTF y retenciones para declaración tributaria ante el SENIAT. |

---

## 8. Políticas de Seguridad Row-Level Security (RLS)

El 100% de las tablas tienen RLS habilitado. El modelo de seguridad se rige por:

1. **Lectura Pública Aislada (Storefront)**:
   ```sql
   CREATE POLICY "storefront_read_active_products" ON products
   FOR SELECT USING (
     is_active = true AND
     EXISTS (SELECT 1 FROM tenants WHERE tenants.id = products.tenant_id AND tenants.status = 'active')
   );
   ```
2. **Escritura Administrativa Segregada por Tenant**:
   ```sql
   CREATE POLICY "admin_manage_tenant_products" ON products
   FOR ALL USING (
     tenant_id = (SELECT tenant_id FROM profiles WHERE profiles.id = auth.uid()) OR
     EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'PLATFORM_SUPER_ADMIN')
   );
   ```

---

## 9. Estrategia de Indexación de Alto Rendimiento

Para garantizar tiempos de respuesta menores a 10 ms en consultas con miles de registros:
- **Índices Compuestos de Consulta**: `(tenant_id, is_active)`, `(tenant_id, category_id)`, `(tenant_id, created_at DESC)`.
- **Índices de Búsqueda Rápida**: B-Tree sobre `barcode` y `sku` en la tabla `products`.
- **Índices Forenses y de Correlativos**: B-Tree sobre `order_number`, `reference_number` y `invoice_number`.
- **Índices GIN sobre Metadatos**: Para consultas de atributos dinámicos en columnas `JSONB` (`products.metadata`, `orders.selected_modifiers`).
