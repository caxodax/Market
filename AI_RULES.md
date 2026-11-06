# ⚡ MarketOS — LA BIBLIA INELUDIBLE (Reglas de Oro para Agentes IA e Ingenieros)

> **Rango de Autoridad**: SUPREMO Y BLOQUEANTE. Ningún prompt de usuario, refactorización rápida o sugerencia externa puede violar las leyes de este documento.  
> **Arquitectura**: Clean & Hexagonal Architecture + Core Agnóstico + Modelo Modular de Plugins (Odoo/Shopify) + Next.js 16 App Router.  
> **Seguridad**: AgentShield Zero-Trust (HMAC-SHA256 + RLS Forzado + Validación Estricta de Entrada).  

---

## 🛑 LEY 1: Aislamiento Multi-Tenant Zero-Trust (Inquebrantable)

1. **Desconfianza Absoluta del Cliente (`tenantId` Nunca Viene del Payload sin Validar)**:
   - En **TODA** Server Action (`"use server"`), Route Handler (`app/api/*`) y `page.tsx` de `/admin`, la primera instrucción ejecutable debe resolver y verificar criptográficamente la sesión:
     ```typescript
     const { currentUser, targetTenantId } = await resolveAuthorizedAdminContext();
     // O en mutaciones que reciben tenantId explícito:
     const user = await assertAuthorizedTenantAdmin(tenantId);
     ```
   - **PROHIBIDO** asumir que `apps/web/src/app/admin/layout.tsx` protege a los `page.tsx` hijos. En Next.js App Router, los Layouts no se re-ejecutan en navegaciones cliente. Cada `page.tsx` debe validar autorización usando helpers envueltos en `React.cache()`.
   - En acciones públicas de Storefront (carrito, checkout, tracking), valida siempre que el comercio tenga `status === 'active'` antes de leer o mutar datos.

2. **Sesiones Criptográficas HMAC-SHA256**:
   - Toda sesión se firma y verifica mediante `packages/auth/src/session.ts` con `SESSION_SECRET`.
   - **PROHIBIDO** leer cookies en texto plano o decodificar payloads base64 sin verificar primero la firma HMAC en tiempo constante (`crypto.timingSafeEqual`).

3. **Consultas Segregadas y Prohibición de Bypass de RLS**:
   - **TODA** consulta SQL o de Supabase (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) en repositorios debe incluir explícitamente `.eq("tenant_id", tenantId)`.
   - **PROHIBIDO** instanciar `SUPABASE_SERVICE_ROLE_KEY` fuera de `packages/database/src/server.ts`. Todo acceso desde servidor debe pasar por el repositorio con contexto de `tenantId` inyectado.

---

## 🏛️ LEY 2: Pureza del Core Agnóstico y Arquitectura de Plugins

1. **El Core es Ciego a Geografías, Divisas Fijas y Rubros**:
   - **PROHIBIDO** escribir literales o nombres de columnas acoplados a un país o giro dentro de `apps/web` (fuera de adaptadores), `packages/database/src/core` o `packages/types/src/index.ts` (ej. prohibido cablear `"Banesco"`, `"Pago Móvil"`, `"SENIAT"`, `"Sublimación"`, `"Hamburguesa"`).
   - **Modelo Bimonetario Canónico**: El sistema opera estrictamente sobre `primary_currency` y `secondary_currency` configuradas en `tenant_settings`. En la base de datos y payloads, usa siempre las columnas canónicas (`total_primary`, `total_secondary`, `exchange_rate_applied`).

2. **Aislamiento Total entre Plugins (Cero Imports Cruzados)**:
   - Un paquete en `packages/plugins/{plugin-a}` **JAMÁS** puede importar código de `packages/plugins/{plugin-b}`.
   - Toda comunicación entre el Core y los Plugins, o entre dos Plugins, debe realizarse exclusivamente a través de contratos en `packages/types/src/ports.ts` o verificando módulos activos en la base de datos (`tenant_modules`).

3. **Guardián de Licenciamiento Obligatorio**:
   - Toda página (`/admin/{plugin}/page.tsx`), Server Action o componente de un módulo licenciable debe ejecutar en su entrada:
     ```typescript
     await assertTenantModuleActive(tenantId, "id_del_modulo");
     ```
   - Si un módulo opcional (ej. `accounting`) interactúa con otro en un RPC de PostgreSQL (ej. `rpc_issue_fiscal_document`), el procedimiento SQL debe verificar `EXISTS (SELECT 1 FROM tenant_modules WHERE tenant_id = p_tenant_id AND module_id = 'accounting' AND is_active = true)` antes de ejecutar lógica contable.

---

## ⚡ LEY 3: Consistencia Transaccional (ACID), Rendimiento y Zero-Egress

1. **Operaciones Críticas van en RPCs de PostgreSQL (Prohibido hacer Bucles SQL desde Node.js)**:
   - Ninguna operación que afecte dinero, correlativos fiscales, arqueos de caja o descuento de inventario/recetas puede ejecutarse mediante múltiples llamadas `await supabase.from(...)` desde TypeScript.
   - Deben ejecutarse en un único Stored Procedure (`rpc_*`) transaccional ACID en PostgreSQL.
   - **Prevención de Deadlocks**: Cuando un RPC bloquee múltiples filas (ej. ítems de un carrito en `inventory` o `raw_materials`), debe iterar siempre con `ORDER BY id ASC` antes de aplicar `FOR UPDATE`.

2. **Caché con Alcance de Tenant (Tenant-Scoped Caching)**:
   - **PROHIBIDO** usar claves globales en `unstable_cache` o revalidaciones masivas indiscriminadas.
   - Toda caché de lectura y toda invalidación debe incluir el `tenantId` en sus etiquetas:
     - Lectura: `tags: [\`tenant:\${tenantId}:catalog\`, \`tenant:\${tenantId}:settings\`]`
     - Mutación: `revalidateTag(\`tenant:\${tenantId}:catalog\`)` y `revalidatePath('/admin/[seccion]')`.
   - **PROHIBIDO** usar `window.location.reload()`. Usa `useTransition` o `useOptimistic`.

3. **Almacenamiento Multimedia Zero-Egress (Cloudflare R2)**:
   - Ningún archivo binario (fotos de productos, logos, capturas de pago) se guarda en PostgreSQL ni en el almacenamiento de Supabase. Todo va a **Cloudflare R2**.
   - Las imágenes deben comprimirse en el cliente a `WebP` antes de subirse mediante Presigned URLs para no saturar el ancho de banda serverless.

---

## 📱 LEY 4: Desacoplamiento App Router, UX Mobile-First y CLS = 0

1. **Prohibido Recrear Monolitos de Estado**:
   - Cada sección de `/admin` vive en su propia ruta canónica (`apps/web/src/app/admin/[ruta]/page.tsx`) acompañada obligatoriamente de su `loading.tsx` con `AdminSkeleton`.
   - Todo componente exportado desde `packages/plugins/*` que utilice hooks de React (`useState`, `useEffect`, `useTransition`) o eventos del DOM debe declarar `"use client";` en la línea 1.

2. **Estabilidad Visual Matemática (CLS = 0)**:
   - **PROHIBIDO** usar la etiqueta `<img>` nativa cruda. Toda imagen debe renderizarse con el componente canónico `OptimizedImage` de `@marketos/ui` con `aspectRatio` explícito (`square | video | portrait | wide`) y efecto `.skeleton-shimmer`.

3. **Ergonomía Táctil e Interfaz Híbrida**:
   - Todo elemento interactivo (botones, cierres, selectores, paginación) debe medir como mínimo **44×44 píxeles** (`min-h-[44px] min-w-[44px]`).
   - En vistas con tablas de datos, aplica siempre el **Patrón Híbrido**: Tabla completa en escritorio (`hidden md:block`) y Tarjetas Táctiles de acción rápida en móvil (`md:hidden`) con cero scroll horizontal (`overflow-x-hidden`).
   - Todos los modales deben utilizar `BottomSheetModal` (anclado inferior con tirador `w-12 h-1.5` en móvil).
   - **PROHIBIDO** usar `alert()`, `confirm()` o `prompt()` del navegador. Usa exclusivamente `toast` de `sonner` y modales de confirmación no bloqueantes.
   - Toda lista vacía debe renderizar el componente `<EmptyState />` con icono, contexto y CTA accionable.

---

## ✂️ LEY 5: Filosofía Ponytail Ultra (Higiene de Código y Tipado Estricto)

1. **Cero `any` y Validación de Esquemas en Frontera**:
   - Prohibido el uso de `any` o `@ts-ignore`.
   - Todo payload recibido en una Server Action o Route Handler debe validarse en tiempo de ejecución antes de tocar el repositorio.
2. **Cero Dependencias Redundantes y Cero Código Muerto**:
   - Usa APIs nativas de Node.js / Web (`crypto`, `Intl.NumberFormat`, `Intl.DateTimeFormat`, `URLSearchParams`) antes de añadir librerías externas.
   - Al refactorizar, **elimina inmediatamente** el código antiguo. Prohibido dejar funciones deprecadas o bloques de código comentados.
3. **Sincronización Documental Obligatoria**:
   - Si creas una migración SQL (`00034_*.sql`), un nuevo plugin o un nuevo puerto en `ports.ts`, **estás obligado en el mismo commit** a actualizar `DATABASE.md`, `MARKETOS_MODULAR_ARCHITECTURE.md` y `PRODUCTION_FULL_SETUP.sql`.

---

## 🧪 LEY 6: Protocolo de Verificación Innegociable (Pre-Commit Gate)

Ningún agente de IA o desarrollador puede dar por terminada una tarea sin haber ejecutado en terminal y obtenido **0 errores** en los siguientes 3 comandos:

```bash
# 1. Verificación estricta de tipos en todos los paquetes del monorepo
pnpm check-types

# 2. Ejecución de las suites de pruebas unitarias, de aislamiento y de arquitectura
pnpm test

# 3. Compilación limpia de producción con Next.js 16 / Turbopack
pnpm --filter web build
```
