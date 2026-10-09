# 🚀 MarketOS • Guía de Despliegue y Puesta en Producción

> **Estado del Sistema:** ✅ Verificado y 100% Listo para Producción.  
> **Arquitectura:** Next.js 16 (Turbopack) • Supabase PostgreSQL • Upstash Redis • Cloudflare R2 • Vercel Cron.

---

## 📋 Resumen de Arquitectura y Configuración

MarketOS unifica todas las interfaces en la aplicación centralizada **`apps/web`**:
1. **Tienda / Catálogo Digital PWA:** Acceso público en `/` (Catálogo, carrito reactivo, cálculo dual USD/Bs., checkout Pago Móvil/Zelle).
2. **Tenant Admin (Comercio):** Acceso en `/admin` (Validación de pagos, despacho de pedidos, inventario, delivery, equipo y **Tasas e Histórico**).
3. **Master Platform (Super Admin):** Acceso en `/platform` (Directorio SaaS, suscripciones, métricas y **Tasas Globales**).
4. **Endpoint Cron Autónomo:** `/api/cron/bcv-sync` (Sincronización diaria con AlCambio GraphQL y BCV).

---

## 🛠️ Paso 1: Base de Datos Supabase

Tienes dos formas de inicializar la base de datos en Supabase:

### Opción A (Recomendada - 1 Solo Clic):
1. Abre tu panel de Supabase: **SQL Editor > New Query**.
2. Copia y pega el contenido completo de:  
   [`packages/database/supabase/PRODUCTION_FULL_SETUP.sql`](file:///home/lmontes/Documentos/Telegram/Market/packages/database/supabase/PRODUCTION_FULL_SETUP.sql)
3. Presiona **Run**. Esto creará:
   - Todas las tablas con RLS (Row Level Security) activo.
   - Restricciones únicas e índices de alta velocidad.
   - Semilla inicial de comercio (`Shop Market C.A.`), categorías y productos.
   - Historial de tasas de cambio con registros oficiales.
   - Extensiones `pg_cron` y `pg_net` para sincronización a las 7:00 AM VET.

### Opción B (Migraciones Individuales):
Ejecuta secuencialmente en el SQL Editor los archivos en:
- `00001_initial_schema.sql`
- `00002_seed_shop_market.sql`
- `00003_phase_2_operational.sql`
- `00004_phase_3_saas_multi_tenant.sql`
- `00005_phase_4_production_hardening.sql`
- `00006_auth_roles_profiles.sql`
- `00007_supabase_cron_bcv_sync.sql`
- `00008_exchange_rate_history.sql`

---

## ☁️ Paso 2: Despliegue en Vercel

### Configuración del Proyecto en Vercel:
1. En Vercel Dashboard, haz clic en **Add New... > Project** e importa el repositorio de Git de MarketOS.
2. En la sección **Root Directory**:
   - Selecciona **`apps/web`** (o déjalo en la raíz si usas el selector de monorepo).
3. **Framework Preset:** `Next.js`.
4. **Build Command:** Déjalo por defecto (`next build` o `pnpm build`).
5. **Output Directory:** Déjalo por defecto (`.next`).
6. **Install Command:** `pnpm install`.

### Blindaje de Cuota Hobby ($0 Overages):
* **Imágenes protegidas:** `apps/web/next.config.ts` ya tiene `images: { unoptimized: true }`. Las fotos se cargan directo desde Cloudflare R2 sin gastar la cuota mensual de 5,000 imágenes de Vercel.
* **Ignored Build Step:** En **Settings > Git > Ignored Build Step**, selecciona **Custom** y escribe:
  ```bash
  npx turbo-ignore
  ```
  Esto evita que Vercel gaste minutos de compilación cuando los commits no afecten a la app.

---

## 🔑 Paso 3: Variables de Entorno en Producción

En **Vercel Dashboard > Project Settings > Environment Variables**, agrega las siguientes variables (copiables desde tu `.env.local` o `.env.example`):

| Variable | Tipo | Descripción | Ejemplo / Valor |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Público | URL del proyecto Supabase | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Público | Llave anónima pública de Supabase | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Secreto | Llave maestra para Cron y Auth | `eyJhbGciOi...` |
| `UPSTASH_REDIS_REST_URL` | Secreto | Endpoint REST de Upstash Redis | `https://xxxx.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Secreto | Token de autenticación de Upstash | `AYy0...` |
| `CLOUDFLARE_ACCOUNT_ID` | Secreto | Account ID de Cloudflare | `e96fb944...` |
| `R2_ACCESS_KEY_ID` | Secreto | Access Key de Cloudflare R2 | `d8ff...` |
| `R2_SECRET_ACCESS_KEY` | Secreto | Secret Key de Cloudflare R2 | `1020...` |
| `R2_BUCKET_NAME` | Secreto | Nombre del bucket R2 | `marketos-media` |
| `R2_PUBLIC_DOMAIN` | Público | Dominio CDN público de R2 | `https://pub-xxxx.r2.dev` |
| `CRON_SECRET` | Secreto | Token aleatorio para proteger cron | `clave-secreta-cron-marketos` |
| `DEFAULT_TENANT_ID` | General | Slug/ID del tenant inicial | `shop-market-ca` |
| `DEFAULT_TENANT_NAME` | General | Nombre del primer comercio | `Shop Market C.A.` |
| `DEFAULT_CURRENCY` | General | Moneda base del catálogo | `USD` |

---

## ⏰ Paso 4: Automatización de la Tasa de Cambio (BCV)

1. **Vercel Cron:**  
   [`apps/web/vercel.json`](file:///home/lmontes/Documentos/Telegram/Market/apps/web/vercel.json) ya incluye:
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/bcv-sync",
         "schedule": "0 11 * * *"
       }
     ]
   }
   ```
   * Corre automáticamente **todos los días a las 7:00 AM hora de Venezuela (11:00 UTC)**, exactamente igual que KsaSport.
   * Puedes verificar las ejecuciones en **Vercel Dashboard > Proyecto > Settings > Cron Jobs**.

2. **Supabase Cron (Opcional como respaldo dual):**  
   Si ejecutaste la migración `00007_supabase_cron_bcv_sync.sql`, `pg_cron` también ejecutará la sincronización directamente en Postgres.

---

## 🛡️ Paso 5: Seguridad y Roles de Acceso Iniciales

Los perfiles del sistema admiten los siguientes roles:
* **`PLATFORM_SUPER_ADMIN`**: Acceso total al master en `/platform` y `/admin`.
* **`TENANT_OWNER`**: Dueño del comercio en `/admin` (Caja, inventario, delivery, finanzas, tasas).
* **`TENANT_MANAGER`**: Encargada operativa de tienda.
* **`TENANT_CASHIER`**: Cajero para aprobar o rechazar comprobantes de Pago Móvil / Zelle.
* **`TENANT_INVENTORY`**: Control de stock y faltantes.
* **`TENANT_DELIVERY`**: Repartidor en moto/auto para confirmación de rutas.
* **`CUSTOMER`**: Cliente final en `/` con carrito y seguimiento de pedidos.

---

## 🧪 Diagnóstico de Servicios Pre-Lanzamiento

Para comprobar el estado de conexión de toda la infraestructura antes de anunciar el lanzamiento, ejecuta en la terminal:

```bash
pnpm verify
```

Este script ejecuta en tiempo real:
* Test de lectura y RLS de **Supabase PostgreSQL**.
* Test de lectura/escritura/expiración en **Upstash Redis**.
* Test de operaciones de objetos en **Cloudflare R2**.
