# 📋 TRAZABILIDAD: MODO SANDBOX/PRUEBA END-TO-END (PRODUCTOS + ÓRDENES) Y SANEAMIENTO DE PRODUCCIÓN
**MarketOS Multi-Tenant Platform**  
**Fecha de Registro:** 4 de Noviembre de 2026  
**Estado:** ACTUALIZADO CON COBERTURA DE ÓRDENES (Pendiente de Aprobación por el Usuario)  
**Alcance:** Aislamiento universal de punta a punta (de la A a la Z) para todos los comercios (`printopink`, `shop-market-ca`, `garage`, y futuros tenants)

---

## 1. Contexto e Incidencia Diagnosticada

### 1.1 Síntoma
En el storefront público de producción de Vercel (`https://market-git-main-luis-montes-projects.vercel.app/t/printopink`) se observó la aparición automática de productos repetidos con el nombre **"Tazas Personalizadas"** a un precio de **$5.50 USD**, stock de 30 unidades y sin fotografía, así como una categoría redundante denominada *"Tarjetas de Presentación"* en el menú lateral. Asimismo, se detectaron órdenes de prueba (`ORD-329943`, `ORD-534979`, `ORD-819289`) y comprobantes de pago en `shop-market-ca`.

### 1.2 Causa Raíz Técnica
1. **Código en la Suite de Pruebas:**  
   En el commit `bd8fc34716bed6c093dfc54184311ac2c971b16c`, dentro del archivo [`packages/database/src/__tests__/order-persistence.test.ts`](file:///home/lmontes/Documentos/Telegram/Market/packages/database/src/__tests__/order-persistence.test.ts#L130-L136), se introdujeron llamadas directas de mutación al repositorio:
   ```typescript
   // Creación de orden de prueba
   const orderA = await MarketOSRepository.createOrder(inputA);
   // Envío de comprobante de pago de prueba
   await MarketOSRepository.submitPaymentProof({ tenantId: tenantA, orderId: orderA.id, ... });
   // Creación de producto
   const createdProd = await MarketOSRepository.createProduct({
     tenantId: "printopink",
     name: "Tazas Personalizadas",
     priceUsd: 5.5,
     categoryId: catPrintopink.id,
     initialStock: 30,
   });
   ```
2. **Inyección de Credenciales Reales en Tests:**  
   En [`packages/database/package.json`](file:///home/lmontes/Documentos/Telegram/Market/packages/database/package.json#L13), el script de test estaba configurado con:
   ```json
   "test": "node --env-file-if-exists=../../.env.local --experimental-strip-types src/__tests__/order-persistence.test.ts"
   ```
   Al ejecutarse con `--env-file-if-exists=../../.env.local`, Node cargó la variable de servicio `SUPABASE_SERVICE_ROLE_KEY` y la URL productiva de Supabase (`https://xiklunkmdpqzlhmrfkql.supabase.co`).
3. **Disparador por Skills (Ponytail Ultra / Superpowers TDD / ECC):**  
   Al interactuar con skills que operan con rigor de verificación previa (TDD, Ponytail ultra, AgentShield), la suite de pruebas `turbo test` o `pnpm test` se ejecutó para validar la integridad del sistema.
4. **Falta de Teardown (Limpieza):**  
   La prueba no contaba con un bloque `finally` ni eliminación posterior (`deleteProduct`, anulación de órdenes). Cada corrida generó productos y órdenes en Supabase.
5. **Caché en Vercel:**  
   Next.js almacenó en su caché de fetch (`tenant-products-printopink`) los productos insertados, exponiéndolos en la tienda web pública.

---

## 2. Registro de Datos Ficticios a Sanear en Supabase

Antes de activar el nuevo modo, se requiere eliminar quirúrgicamente los datos generados durante las pruebas:

### 2.1 Productos "Tazas Personalizadas" en `printopink` (7 registros)
| ID del Producto | Tenant | Precio | Fecha de Creación (UTC) |
| :--- | :--- | :--- | :--- |
| `a1dc6ca3-84cc-4246-b323-69d190049187` | `printopink` | $5.50 | 2026-11-03 13:28:01 |
| `9683baed-5f02-4b33-a9a3-0be29f382ab6` | `printopink` | $5.50 | 2026-11-03 13:29:13 |
| `81d5f4df-82d0-43c3-93ed-be17e201629c` | `printopink` | $5.50 | 2026-11-03 13:49:10 |
| `6b3d6296-91e8-4fae-a1af-dfe5e48d3844` | `printopink` | $5.50 | 2026-11-03 15:58:54 |
| `b98981c4-b091-4e7b-a4fd-56ee0d06a4fb` | `printopink` | $5.50 | 2026-11-03 18:25:44 |
| `be7becb7-0714-4e8f-b5cb-1292205cbe92` | `printopink` | $5.50 | 2026-11-03 19:52:24 |
| `6075f734-c5fb-4534-be31-b14e5186e3bb` | `printopink` | $5.50 | 2026-11-04 12:20:28 |

*Nota:* También se eliminarán sus 7 filas correspondientes en `inventory` y 7 filas en `inventory_movements`.

### 2.2 Categoría Fantasma en `printopink` (1 registro)
* **ID:** `d355e0d5-0b78-4cf8-ae05-0d1c0b0d23b0`
* **Nombre:** *"Tarjetas de Presentación"* (creada por el test; la categoría legítima es *"Papelería & Tarjetas"*).

### 2.3 Órdenes y Pagos de Prueba en `shop-market-ca` (3 órdenes)
* **Órdenes:** `ORD-329943` (`2aa7df51-...`), `ORD-534979` (`7ae74801-...`), `ORD-819289` (`803ec26a-...`).
* **Pagos asociados:** Referencia `151169` (3 registros en tabla `payments`).
* **Ítems asociados:** 3 registros en tabla `order_items`.

### 2.4 Reversión de Precios en `shop-market-ca`
* Restaurar precio original de `Harina PAN Blanca 1kg` (`d1111111-1111-1111-1111-111111111111`) a **$1.25 USD** (se incrementó en cada test a $1.35).

---

## 3. Especificación del Modo Sandbox End-to-End (Catálogo ➔ Carrito ➔ Orden ➔ Pago)

### 3.1 Cobertura de la A a la Z
Para que puedas realizar un flujo completo de compra y pruebas sin contaminar nunca la contabilidad real de ningún comercio:
1. **Catálogo (`products`):** Soporta productos de prueba.
2. **Órdenes (`orders`):** Soporta compras de prueba con estado sandbox.
3. **Tablas Hijas por Relación (`order_items`, `payments`, `inventory`):** Quedan automáticamente catalogadas como prueba a través del `order_id` o `product_id`.

```
FLÚJO COMPLETO EN MODO SANDBOX:
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ Producto        │ ────> │ Carrito         │ ────> │ Orden           │ ────> │ Pago / Recibo   │
│ is_test = true  │       │ (Retiene flag)  │       │ is_test = true  │       │ (Hereda flag)   │
└─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘
                                                             │
                                                             ▼
                                                    ┌─────────────────┐
                                                    │ ANALÍTICAS /    │
                                                    │ SENIAT / CUOTAS │
                                                    │ INTACTOS        │
                                                    │ (Se excluyen)   │
                                                    └─────────────────┘
```

### 3.2 Comportamiento por Entorno

* **En Producción (Vercel):**
  - **Catálogo:** Los clientes reales solo ven productos con `is_test = false`.
  - **Métricas & Ventas (`getSalesAnalytics`):** La facturación, ingresos en USD/Bs y volumen de ventas **excluyen** estrictamente órdenes con `is_test = true`. El comerciante nunca verá ingresos inflados ni falsos.
  - **Facturación Fiscal (SENIAT / Invoicing):** Las órdenes con `is_test = true` tienen **bloqueado el avance de secuencias fiscales** reales.
  - **Panel de Órdenes:** El listado de pedidos del comercio muestra por defecto los pedidos reales. Opcionalmente dispone de un filtro `[Reales | Pruebas Sandbox]`.

* **En Local (localhost / dev):**
  - Permite crear productos y procesar órdenes completas de prueba.
  - Los productos y órdenes de prueba se distinguen visualmente con un chip `[ 🧪 Sandbox / Local ]`.

---

## 4. Matriz de Trazabilidad: Archivos a Modificar / Crear

A continuación se detalla cada archivo que intervendrá en la solución, las líneas afectadas y la justificación técnica:

### 1. Base de Datos Supabase (PostgreSQL DDL)
* **Acción:** Ejecución de migración DDL en Supabase para `products` y `orders`.
* **SQL:**
  ```sql
  -- 1. Columna Sandbox en Productos
  ALTER TABLE products ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
  CREATE INDEX IF NOT EXISTS idx_products_tenant_test ON products(tenant_id, is_test, is_active);

  -- 2. Columna Sandbox en Órdenes
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
  CREATE INDEX IF NOT EXISTS idx_orders_tenant_test ON orders(tenant_id, is_test, status);
  ```
* **Justificación:** Otorga soporte nativo en BD tanto para catálogo como para órdenes con costo cero en filas existentes (`DEFAULT FALSE`).

---

### 2. `packages/types/src/index.ts`
* **Acción:** Modificación de interfaces TypeScript.
* **Líneas aproximadas:**
  - L648 (en `interface Product`): `is_test?: boolean;`
  - L725 (en `interface Order`): `is_test?: boolean;`
  - L1082 (en `interface CreateProductInput`): `isTest?: boolean;`
  - L59 (en `interface CreateOrderInput` dentro de `packages/database` / types): `isTest?: boolean;`
* **Justificación:** Tipado estricto en todo el monorepo para garantizar compilación limpia y auto-completado.

---

### 3. `packages/database/src/repositories/catalog.repository.ts`
* **Acción:** Modificación del repositorio central de catálogo.
* **Secciones:**
  1. **Método `getProducts` (L425-L440):**  
     Inyectar condición para ocultar productos test en producción:
     ```typescript
     const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
     let simpleQ = supabase.from("products").select("*").eq("tenant_id", tenantId).eq("is_active", true);
     if (isProduction) {
       simpleQ = simpleQ.eq("is_test", false);
     }
     ```
  2. **Método `createProduct` (L512-L545):**  
     Detectar contexto de test o recibir `input.isTest`:
     ```typescript
     const isTestEnv = process.env.NODE_ENV === "test" || process.env.IS_TEST_ENV === "true";
     const isTestProduct = input.isTest ?? isTestEnv ?? false;
     insertPayload.is_test = isTestProduct;
     createdProduct.is_test = isTestProduct;
     ```
  3. **Método `getTenantPlanLimits` (L505):**  
     Excluir productos `is_test = true` del conteo de cuota de plan SaaS.

---

### 4. `packages/database/src/repositories/order.repository.ts`
* **Acción:** Blindaje del ciclo de órdenes y analítica.
* **Secciones:**
  1. **Método `createOrder` (L530-L560):**  
     Si `input.isTest` es true (o el proceso corre en test), guardar `is_test: true` en la tabla `orders`:
     ```typescript
     const isTestEnv = process.env.NODE_ENV === "test" || process.env.IS_TEST_ENV === "true";
     const isTestOrder = input.isTest ?? isTestEnv ?? false;
     orderInsertPayload.is_test = isTestOrder;
     newOrder.is_test = isTestOrder;
     ```
  2. **Método `getTenantOrders` (L890-L915):**  
     En producción, filtrar por defecto `.eq("is_test", false)` para que el panel operativo del comercio no se contamine con pruebas.
  3. **Método `getSalesAnalytics` (L1035-L1050):**  
     Excluir automáticamente cualquier orden donde `o.is_test === true` del cálculo de ingresos brutos, volumen y ticket promedio.

---

### 5. `packages/database/package.json`
* **Acción:** Desacoplar comando de test de las credenciales de producción.
* **Línea:** L13
* **Antes:**
  ```json
  "test": "node --env-file-if-exists=../../.env.local --experimental-strip-types src/__tests__/order-persistence.test.ts"
  ```
* **Después:**
  ```json
  "test": "NODE_ENV=test node --experimental-strip-types src/__tests__/order-persistence.test.ts"
  ```
* **Justificación:** Los tests locales no deben levantar por defecto las credenciales maestras de Supabase productivo a menos que se defina un entorno mock o sandbox explícito.

---

### 6. `packages/database/src/__tests__/order-persistence.test.ts`
* **Acción:** Marcar tanto la orden como el producto con `isTest: true`, y asegurar limpieza (`teardown`).
* **Líneas:** L33 y L130
* **Cambio:**
  ```typescript
  // 1. Orden en modo prueba
  const orderA = await MarketOSRepository.createOrder({
    ...inputA,
    isTest: true,
  });

  // 2. Producto en modo prueba
  const createdProd = await MarketOSRepository.createProduct({
    tenantId: "printopink",
    name: "Tazas Personalizadas",
    priceUsd: 5.5,
    categoryId: catPrintopink.id,
    initialStock: 30,
    isTest: true,
  });
  ```
  Y al finalizar el bloque de pruebas:
  ```typescript
  // Limpieza inmediata para no dejar basura persistente
  await MarketOSRepository.deleteProduct("printopink", createdProd.id);
  ```

---

### 7. `apps/web/src/components/product-card.tsx`
* **Acción:** Distintivo visual en modo local.
* **Líneas:** L55-L65
* **Cambio:**
  ```tsx
  {product.is_test && (
    <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-white shadow-xs tracking-wider">
      🧪 SANDBOX
    </span>
  )}
  ```

---

### 8. Script de Saneamiento: `scripts/sanitize-live-test-data.mjs` (Nuevo)
* **Acción:** Archivo independiente para ejecutar la limpieza de las filas contaminadas en Supabase y revalidar la caché de Vercel.
* **Ubicación:** `scripts/sanitize-live-test-data.mjs`
* **Función:**
  1. Conecta con la clave de servicio a Supabase.
  2. Borra los 7 IDs de "Tazas Personalizadas" y sus inventarios.
  3. Borra la categoría `d355e0d5-...`.
  4. Borra las 3 órdenes de prueba (`ORD-329943`, `ORD-534979`, `ORD-819289`), sus ítems y pagos en `shop-market-ca`.
  5. Restaura el precio original de Harina PAN a $1.25.
  6. Revalida la caché del storefront.

---

## 5. Plan de Reversión (Rollback Plan)

Si en cualquier momento se desea anular o revertir este cambio, el procedimiento exacto es:

1. **Reversión de Código (Git):**
   ```bash
   git revert HEAD
   ```
2. **Reversión en Base de Datos (Supabase SQL):**
   ```sql
   ALTER TABLE products DROP COLUMN IF EXISTS is_test;
   DROP INDEX IF EXISTS idx_products_tenant_test;

   ALTER TABLE orders DROP COLUMN IF EXISTS is_test;
   DROP INDEX IF EXISTS idx_orders_tenant_test;
   ```
3. **Efecto Post-Reversión:**  
   El sistema regresa exactamente al estado anterior sin pérdida de ningún dato legítimo de los comercios.

---

## 6. Regla de Gobernanza Permanente para Agentes y Skills

Para evitar cualquier reincidencia en el futuro:
* **Regla Inmutable:** Ningún agente de IA (independientemente del modo en que opere: lite, full o ultra) tiene permitido crear productos u órdenes en comercios de producción sin marcar explícitamente `is_test: true` o a menos que el usuario lo solicite expresamente en la conversación.
* **Aislamiento Multi-Tenant:** Ninguna prueba de integración debe alterar precios o datos de inventario de comercios registrados sin revertirlos en el mismo ciclo de ejecución (`finally`).

---
*Fin del documento de trazabilidad.*
