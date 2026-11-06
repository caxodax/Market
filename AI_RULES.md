# 🤖 MarketOS — Reglas de Oro para Agentes IA y Desarrolladores

> **Propósito**: Este documento establece las directrices no negociables de arquitectura, seguridad, interfaz y calidad de código para cualquier agente de inteligencia artificial (AGY, Gemini, Claude, Copilot) o ingeniero que colabore en el repositorio **MarketOS**.  
> **Estándares Base**: AgentShield (Seguridad Criptográfica Multi-Tenant) + Ponytail Ultra (Máxima Simplicidad, Cero Código Muerto) + Mobile-First Ergonomics.

---

## 🛡️ Regla 1: Aislamiento Multi-Tenant de Confianza Cero (Zero-Trust)

1. **Nunca confíes en el `tenantId` enviado por el cliente**:
   - En toda Server Action (`"use server"`), debes invocar como primera línea:
     ```typescript
     const user = await assertAuthorizedTenantAdmin(tenantId);
     ```
   - Si la acción es pública (ej. carrito o tracking de cliente), valida que el tenant esté en estado `'active'` en la base de datos antes de devolver cualquier información.
2. **Sesiones Criptográficas HMAC-SHA256**:
   - Toda autenticación viaja firmada mediante [`packages/auth/src/session.ts`](file:///home/lmontes/Documentos/Telegram/Market/packages/auth/src/session.ts).
   - **Prohibido terminantemente** implementar mecanismos de bypass de sesión leyendo JSON plano sin verificar la firma criptográfica.
3. **Consultas Segregadas en Repositorios**:
   - Ninguna consulta a PostgreSQL puede carecer de la cláusula `.eq("tenant_id", tenantId)`.
   - Las claves maestras administrativas (`SUPABASE_SERVICE_ROLE_KEY`) solo se ejecutan en entorno servidor seguro (`packages/database/src/server.ts`).

---

## 🏛️ Regla 2: Desacoplamiento en Next.js App Router (Prohibido Crear Monolitos)

1. **Estructura Modular de Sub-rutas**:
   - El panel de administración reside en `apps/web/src/app/admin/`.
   - **Bajo ninguna circunstancia** agregues vistas de cientos de líneas mediante condicionales `activeTab === 'x'` dentro de un único archivo.
   - Cada sección debe contar con su propia carpeta canónica (ej. `/admin/orders/page.tsx`, `/admin/inventory/page.tsx`) con su correspondiente `loading.tsx` para transiciones sin parpadeos.
2. **Revalidación Quirúrgica del Estado**:
   - Al ejecutar mutaciones en Server Actions, revalida exactamente las rutas afectadas:
     ```typescript
     revalidatePath('/admin/orders');
     revalidatePath('/admin/payments');
     ```
   - No fuerces recargas completas de ventana con `window.location.reload()`. Utiliza transiciones optimistas o `useTransition`.

---

## 🧩 Regla 3: Core Agnóstico y Ecosistema de Plugins (Modelo Odoo)

1. **El Core no conoce de bancos, divisas fijas ni giros específicos**:
   - **Prohibido** escribir cadenas como `"Banesco"`, `"Pago Móvil"`, `"Sublimación"` ni `"Hamburguesas"` en el código central de `apps/web` o `packages/types/src/index.ts`.
   - Toda funcionalidad específica de un rubro debe residir dentro de su paquete en `packages/plugins/*`.
2. **Guardián de Licenciamiento**:
   - Toda página o Server Action perteneciente a un plugin debe invocar:
     ```typescript
     await assertTenantModuleActive(tenantId, moduleId);
     ```
3. **Cero Importaciones Cruzadas entre Plugins**:
   - Un plugin jamás debe importar código de un plugin hermano. La comunicación se realiza únicamente a través de los puertos definidos en [`packages/types/src/ports.ts`](file:///home/lmontes/Documentos/Telegram/Market/packages/types/src/ports.ts).

---

## ⚡ Regla 4: Eficiencia Extrema y Zero-Egress (Low-Cost)

1. **Caché en Capa Edge**:
   - Las lecturas frecuentes de catálogo y configuración deben envolverse en [`unstable_cache`](file:///home/lmontes/Documentos/Telegram/Market/apps/web/src/lib/cached-queries.ts) con etiquetas para revalidación bajo demanda (`revalidateTag`).
   - Evita consultas repetitivas a PostgreSQL dentro de bucles o componentes renderizados con frecuencia.
2. **Almacenamiento de Medios en Cloudflare R2**:
   - Las imágenes de productos, logotipos y comprobantes bancarios se almacenan en buckets R2 compatibles con S3 para garantizar **cero coste de transferencia saliente**.

---

## ✂️ Regla 5: Filosofía Ponytail (Cero Sobre-ingeniería)

1. **Prefiere la Biblioteca Estándar**:
   - Antes de instalar un nuevo paquete de npm, pregúntate si puedes resolverlo con JavaScript / TypeScript nativo, la API Web estándar o Node.js (`crypto`, `path`, `URLSearchParams`).
2. **Cero Flexibilidad Especulativa (YAGNI)**:
   - No construyas interfaces genéricas para casos de uso que no existen en los requisitos actuales.
   - El código más rápido, más seguro y más fácil de mantener es el que no hace falta escribir.
3. **Limpieza de Código Muerto**:
   - Si refactorizas una función o un componente, elimina las versiones deprecadas. No dejes bloques de código comentados en producción.

---

## 📱 Regla 6: Estándares de Diseño y Experiencia Móvil de Élite

1. **Estabilidad Visual (CLS = 0)**:
   - Toda imagen debe renderizarse usando el componente [`OptimizedImage`](file:///home/lmontes/Documentos/Telegram/Market/packages/ui/src/components/optimized-image.tsx) con `aspectRatio` forzado para evitar saltos en la pantalla al cargar.
2. **Ergonomía Táctil**:
   - Todos los botones, tiradores y selectores deben contar con áreas táctiles de mínimo **44×44 píxeles** (`min-h-[44px] min-w-[44px]`).
   - Modales móviles deben abrirse como *Bottom-Sheets* con tirador físico (`w-12 h-1.5`) anclados al fondo de la pantalla.
3. **Notificaciones Modernas**:
   - **Prohibido** usar `alert()` o `confirm()` nativos del navegador. Utiliza siempre `toast.success()`, `toast.error()` o `toast.warning()` de **Sonner**.
4. **Estados Vacíos con Propósito**:
   - En lugar de mostrar textos planos como *"No hay datos"*, utiliza el componente [`EmptyState`](file:///home/lmontes/Documentos/Telegram/Market/apps/web/src/components/ui/empty-state.tsx) con un ícono claro, mensaje de contexto y botón de acción sugerida.
5. **Jerarquía Visual de KPIs**:
   - Diseña tarjetas de métricas bajo el patrón **"Big Number / Small Label"**: número principal en tipografía grande (`font-heading font-extrabold`), etiqueta explicativa pequeña y badges de color suave.

---

## 🧪 Regla 7: Disciplina de Verificación Obligatoria

Antes de dar por concluida cualquier tarea o proponer un commit al repositorio, **debes ejecutar y superar con éxito**:

```bash
# 1. Verificación de tipos TypeScript en los 20 paquetes del monorepo
pnpm check-types

# 2. Ejecución de la suite completa de pruebas unitarias y de arquitectura (16 suites)
pnpm test

# 3. Compilación de producción con Turbopack
pnpm --filter web build
```

Si alguno de estos comandos arroja un error o advertencia crítica, **corrígelo de inmediato antes de notificar al usuario**. No dejes tareas a medio verificar.
