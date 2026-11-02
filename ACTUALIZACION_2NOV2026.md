# MarketOS — Hoja de Ruta de Ejecución Técnica (Actualización 2-Nov-2026)

> **Documento de Control y Seguimiento de Tareas**  
> **Objetivo**: Limpiar la deuda técnica de la BD, implementar el modelo bimonetario dual (`primary` / `secondary`), aplicar los Stored Procedures (RPCs) transaccionales sugeridos por el agente Argon, y desacoplar el Storefront para que **Shop Market** (retail) y **Printo Prink** (sublimación / MTO-CPQ) coexistan sin colisiones.

---

## Estado General de Fases

- [x] **Fase 1**: Limpieza de Base de Datos y Modelo Bimonetario Universal
- [x] **Fase 2**: Motor Transaccional de Stored Procedures (Migración `00030_core_transactional_rpcs.sql`)
- [x] **Fase 3**: Desacoplamiento del Storefront (Soporte Nativo Printo Prink vs Shop Market)
- [x] **Fase 4**: Refactorización de Repositorios y Poda de `services.ts`
- [x] **Fase 5**: Certificación de Calidad, Tests Unitarios y Verificación End-to-End

---

## 📌 FASE 1: Limpieza de Base de Datos y Modelo Bimonetario Universal (COMPLETADA ✅)

*Objetivo: Eliminar tablas fantasma, corregir tipos de datos y estandarizar la arquitectura bimonetaria sin amarrarse a `_usd` o `_ves`.*

- [x] **1.1. Unificación de Perfiles de Usuario**:
  - Fusionar la tabla duplicada `user_profiles` dentro de `profiles`.
  - Asegurar que `profiles.id` sea clave foránea directa con `auth.users(id) ON DELETE CASCADE`.
  - Deprecar y eliminar `user_profiles`.
- [x] **1.2. Poda de Tablas Muertas / Redundantes**:
  - Eliminar tablas obsoletas de prototipo: `mto_quote_requests` y `mto_materials` (sustituidas 100% por el motor formal `cpq_*`).
  - Eliminar `tenant_plan_limits` redundante; centralizar el control de planes en `subscription_plans` y `tenant_subscriptions`.
- [x] **1.3. Ajuste de Tipos de Datos (Soporte de Peso / Granel)**:
  - Cambiar `inventory.quantity` y `min_quantity` de `INTEGER` a `NUMERIC(12, 3)` para permitir ventas por kilogramo y gramos en minimarket (quesos, jamón, carnes, verduras).
  - Estandarizar columnas de precios y montos a `NUMERIC(12, 2)`.
  - Estandarizar tasas de cambio a `NUMERIC(14, 4)`.
- [x] **1.4. Modelo Bimonetario Dual (`primary` / `secondary`)**:
  - En `tenant_settings`: asegurar `primary_currency` (por defecto `'USD'`) y `secondary_currency` (por defecto `'VES'`).
  - En `cash_shifts` (POS): sustituir el saldo único por balances separados para evitar mezclar divisas en la caja física:
    - `opening_cash_primary`, `opening_cash_secondary`
    - `closing_cash_primary`, `closing_cash_secondary`
    - `expected_cash_primary`, `expected_cash_secondary`
- [x] **1.5. Control de Duplicidad de Clientes Invitados**:
  - Crear índice único `idx_customers_tenant_phone` en `customers(tenant_id, phone)` para que los clientes recurrentes no generen filas duplicadas innecesarias.

---

## 📌 FASE 2: Stored Procedures Transaccionales (COMPLETADA ✅)

*Objetivo: Trasladar a PostgreSQL (PL/pgSQL) las 4 operaciones atómicas de alta concurrencia para garantizar ACID y reducir la latencia de red de Vercel.*

- [x] **2.1. Migración `00030_core_transactional_rpcs.sql`**:
  - Creado el archivo de migración en `packages/database/supabase/migrations/00030_core_transactional_rpcs.sql` e incorporado en `PRODUCTION_FULL_SETUP.sql`.
- [x] **2.2. Función `rpc_create_order_atomic`**:
  - Valida cupón de descuento y existencias en una sola transacción con bloqueo `FOR UPDATE`.
  - Si el tenant tiene activo `food_service`, descuenta insumos de materia prima (`raw_materials`) según sus recetas (`product_recipes`).
  - Si es retail (Shop Market), descuenta de `inventory` y registra movimiento en `inventory_movements`.
  - Si es fabricación / sublimación (Printo Prink), registra ítems y genera orden atómicamente.
  - `ROLLBACK` automático de toda la transacción si cualquier insumo o producto no tiene stock disponible.
- [x] **2.3. Función `rpc_issue_fiscal_document`**:
  - Bloqueo `FOR UPDATE` en `tenant_fiscal_sequences` para garantizar correlatividad consecutiva legal SENIAT sin saltos ni colisiones.
  - Inserción de la factura en `fiscal_documents`.
  - Generación automática del asiento contable por partida doble en `journal_entries` y `journal_entry_lines` (plugin `accounting`).
- [x] **2.4. Función `rpc_close_pos_shift`**:
  - Sumatoria y cuadre de caja ciego (USD y VES / primary y secondary) en la base de datos sin desfases de redondeo en JavaScript.
- [x] **2.5. Vistas SQL de Agregación para Reportes**:
  - Función `rpc_get_sales_book` para generar el Libro de Ventas SENIAT directamente desde PostgreSQL en <10 ms.

---

## 📌 FASE 3: Desacoplamiento del Storefront (Shop Market vs Printo Prink) (COMPLETADA ✅)

*Objetivo: Resolver el choque entre el modelo de supermercado y el modelo de sublimación / personalizados en la vitrina pública del cliente.*

- [x] **3.1. Detección Inteligente de Módulos Activos en Storefront**:
  - En `catalog-view.tsx` y `product-card.tsx`, se detecta la capacidad CPQ (`hasCpq`) y módulos activos.
- [x] **3.2. Integración del Configurador Visual para Sublimación (`mto_cpq`)**:
  - Creado `CpqModal` en `@marketos/plugin-mto-cpq` envolviendo `CustomProductConfigurator`.
  - Conectado en `catalog-view.tsx` permitiendo al cliente cotizar medidas, acabados, porcentaje de anticipo y adjuntar su archivo de diseño.
  - El carrito (`cart-context.tsx`) preserva los precios calculados dinámicamente y no los sobreescribe contra precios de estante estáticos ni los bloquea por stock anaquel.
- [x] **3.3. Preservar Compra Rápida para Supermercados (`barcode_retail` / Retail General)**:
  - Mantiene la adición directa con 1 clic para productos de consumo masivo en Shop Market cuando no hay modificadores ni atributos CPQ.
- [x] **3.4. Soporte para Restaurantes (`food_service`)**:
  - Modal de modificadores (salsas, términos, adicionales de costo) preservado y activado exclusivamente si el producto tiene grupos de modificadores asignados.

---

## 📌 FASE 4: Refactorización de Repositorios y Poda de `services.ts` (COMPLETADA ✅)

*Objetivo: Conectar la capa de aplicación con las nuevas RPCs y mantener modularidad limpia con fallbacks de resiliencia.*

- [x] **4.1. Conexión de Repositorios con RPCs de Supabase**:
  - Actualizado `order.repository.ts` para invocar `supabase.rpc('rpc_create_order_atomic', ...)` con preservación de ítems CPQ y compatibilidad bimonetaria dual (`total_primary`, `total_secondary`).
  - Creado `pos.repository.ts` formal con invocación atómica a `supabase.rpc('rpc_close_pos_shift', ...)`.
  - Actualizado `invoicing.repository.ts` con invocación a `rpc_issue_fiscal_document` y `rpc_get_sales_book`.
  - Actualizado `cpq.repository.ts` con soporte de matrices de volumen y fallbacks en memoria.
- [x] **4.2. Delegación Limpia en `MarketOSRepository`**:
  - `services.ts` delega nativamente en `PosRepository`, `InvoicingRepository`, `OrderRepository` y `CatalogRepository`.

---

## 📌 FASE 5: Certificación de Calidad, Tests y Verificación End-to-End (COMPLETADA ✅)

*Objetivo: Validar que ambos comercios operan a la perfección y que toda la suite de pruebas se mantiene en verde.*

- [x] **5.1. Ejecución de Tests Unitarios y de Integración**:
  - Ejecutado `pnpm test`: 15 suites de pruebas aprobadas al 100% sin ningún error.
  - Ejecutado `pnpm check-types`: 18/18 paquetes de TypeScript compilando limpiamente con cero errores.
- [x] **5.2. Verificación de Aislamiento Multi-Tenant (AgentShield)**:
  - Verificado que ningún comercio pueda visualizar o manipular datos de otro tenant (`order-persistence.test.ts` y firmas criptográficas HMAC-SHA256).
- [x] **5.3. Sincronización Final de la Documentación Maestra**:
  - `ARCHITECTURE.md` y `DATABASE.md` actualizados con las 30 migraciones, arquitectura de Stored Procedures y desacoplamiento de storefront.
