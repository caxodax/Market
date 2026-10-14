# Estrategia de Despliegue en Vercel: MarketOS (Hobby a Pro)

> **Documento de Arquitectura y Costos**  
> **Objetivo:** Ejecutar la fase de **Demo y Pruebas en Vercel Hobby ($0)** sin comprometer los proyectos existentes, y definir la configuración **Anti-Cobros Extra** para cuando se migre a **Vercel Pro ($20/mes)** tras cerrar el primer cliente comercial.

---

## 1. Diagnóstico de Situación Actual

### Tu Cuenta Vercel Hobby Compartida
Actualmente tu cuenta personal aloja **4 proyectos activos en producción**:
* `market` (`market-sable-iota.vercel.app` - MarketOS ya desplegado).
* `ksa-sport` (`ksa-sport.vercel.app` - E-commerce deportivo con alto tráfico).
* `foxbyte` (`foxbyte-chi.vercel.app`).
* `azucar-cacao` (`azucar-cacao.vercel.app`).

**Cuotas globales consumidas (Últimos 30 días):**
* **Image Optimization:** `2.3K / 5K` (46% consumido - 2.7K libres).
* **Fluid Active CPU:** `1h 9m / 4h` (Casi 3 horas completas libres).
* **Functions Storage & Bandwidth:** Saludable (`< 1 GB`).

> [!NOTE] Estrategia de Crecimiento y Multi-Tiendas
> Para el análisis a largo plazo con múltiples tiendas y alto tráfico (Vercel Pro vs Render vs VPS Hetzner + Coolify), consulta también: [SCALABILITY_ROADMAP.md](file:///home/lmontes/Documentos/Telegram/Market/SCALABILITY_ROADMAP.md).

---

## 2. Fase 1: Demo & Pruebas en Vercel Hobby ($0 / mes)

Durante esta fase el objetivo es mostrar una **demo funcional impecable a un comercio potencial** sin gastar dinero y sin arriesgar tu cuenta.

### Regla 1: Desactivar la optimización de imágenes de Vercel
En `apps/web`, `apps/admin` y `apps/super-admin`, el archivo `next.config.ts` actualmente permite transformar cualquier imagen remota. En un e-commerce con catálogo, esto devorará la cuota en pocas visitas.

**Solución:** Activar `unoptimized: true` para que las imágenes se sirvan directamente desde Cloudflare R2 sin que Vercel compute transformaciones en el Edge.

```ts
// apps/web/next.config.ts (Aplicar igual en admin y super-admin)
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@marketos/ui",
    "@marketos/utils",
    "@marketos/database",
    "@marketos/auth",
    "@marketos/types",
  ],
  images: {
    unoptimized: true, // <- CERO consumo de cuota de Vercel Image Optimization
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
```

### Regla 2: Configurar `npx turbo-ignore` (Ahorro de Build Minutes)
Como MarketOS es un monorepo Turborepo con 3 aplicaciones, cada vez que hagas un `git push`, Vercel intentaría compilar las 3 apps a la vez. En Hobby sólo tienes **1 slot de compilación simultáneo**, lo que generaría colas lentas.

En el panel de Vercel de cada proyecto:
* Ve a **Settings > Git > Ignored Build Step**.
* Selecciona **Custom**.
* Ingresa el comando:
  ```bash
  npx turbo-ignore
  ```
* *Resultado:* Si un commit solo modificó código de `admin`, Vercel cancelará automáticamente la compilación de `web` y `super-admin`, gastando 0 minutos de build.

### Regla 3: Despliegue selectivo para la Demo
Para la fase de demostración no necesitas desplegar las 3 aplicaciones si no se van a mostrar todas al prospecto:
1. **Prioridad 1:** `apps/web` (El catálogo/tienda que verá el cliente y sus compradores).
2. **Prioridad 2:** `apps/admin` (El panel donde el dueño de la tienda ve pedidos, productos y caja).
3. **Opcional/Postergar:** `apps/super-admin` (Panel maestro de la plataforma; puedes operarlo localmente o en preview).

---

## 3. Fase 2: Transición a Vercel Pro ($20 / mes)

Una vez que el primer market/comercio acepte la propuesta y se firme el acuerdo comercial:
1. Se crea un **Team Pro en Vercel** ($20/mes por 1 asiento).
2. Se migran los proyectos a ese equipo.
3. El costo mensual se cubre con el plan o mensualidad que le cobres a tu cliente.

### Configuraciones "Anti-Cobros Extra" (Zero Overages)

En Vercel Pro, las superaciones de cuota **se cobran automáticamente a tu tarjeta de crédito**. Para evitar facturas sorpresa, aplica estrictamente estas 4 configuraciones:

### 1. Activar Spend Management (Límite Estricto de Facturación)
* Ve a **Vercel Dashboard > Settings > Billing > Spend Management**.
* Activa la casilla **Spend Limit**.
* Configura un límite mensual: **$20 USD** (o máximo $25 USD si permites un margen de seguridad).
* Elige la acción al superar el límite: **"Pause Projects"** o **"Send Alert"** para que nunca te carguen montos imprevistos.

### 2. Evitar el cobro por optimización de imágenes ($5 por cada 1,000 imágenes)
Vercel Pro incluye 1,000 imágenes fuente al mes. En un marketplace con múltiples comercios subiendo fotos de productos, podrías excederlo fácilmente.
* **Estrategia R2 CDN Directo:** Mantén las imágenes multimedia almacenadas en tu bucket de **Cloudflare R2**.
* Cloudflare R2 tiene **$0 costo de transferencia de salida (egress)**.
* Sirve las fotos de productos directamente usando el dominio público de tu bucket (ej. `https://assets.marketos.app/...` o URL de R2).
* Si necesitas miniaturas optimizadas a futuro, genera versiones WebP al momento de subirlas al bucket en vez de procesarlas en tiempo real con Vercel.

### 3. No invitar clientes ni terceros al equipo de Vercel ($20 por usuario)
* En Vercel Pro, **cada miembro agregado al equipo cuesta $20/mes adicionales**.
* Los dueños de tiendas deben interactuar **exclusivamente con `apps/admin`**, usando la autenticación de Supabase con sus roles (`TENANT_OWNER`, `TENANT_MANAGER`).
* Nadie ajeno a ti como desarrollador técnico debe tener cuenta en tu dashboard de Vercel.

### 4. No comprar Build Slots adicionales ($50/mes)
* Vercel ofrece slots concurrentes extras por $50/mes. **No los necesitas**.
* Con `npx turbo-ignore` bien configurado, las compilaciones de cada app se ejecutan en 1 a 2 minutos de forma ordenada sin cuellos de botella.

---

## 4. Guía Paso a Paso: Configurar los Proyectos en Vercel

Crea cada proyecto en Vercel desde el mismo repositorio de GitHub siguiendo esta configuración:

| Configuración | Proyecto 1: Tienda Web | Proyecto 2: Admin Comercio | Proyecto 3: Super Admin |
| :--- | :--- | :--- | :--- |
| **Project Name** | `marketos-web` | `marketos-admin` | `marketos-superadmin` |
| **Framework Preset** | `Next.js` | `Next.js` | `Next.js` |
| **Root Directory** | `apps/web` | `apps/admin` | `apps/super-admin` |
| **Include files outside Root Directory** | ✅ **Activado** (Obligatorio para monorepos) | ✅ **Activado** | ✅ **Activado** |
| **Build Command** | *Dejar por defecto* (`next build`) | *Dejar por defecto* | *Dejar por defecto* |
| **Output Directory** | *Dejar por defecto* (`.next`) | *Dejar por defecto* | *Dejar por defecto* |
| **Install Command** | `pnpm install` | `pnpm install` | `pnpm install` |
| **Ignored Build Step** | `npx turbo-ignore` | `npx turbo-ignore` | `npx turbo-ignore` |

---

## 5. Variables de Entorno Requeridas en Vercel

Configura estas variables en **Settings > Environment Variables** (para los entornos `Production` y `Preview`):

```bash
# Supabase (Database & Auth)
NEXT_PUBLIC_SUPABASE_URL=https://<tu-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<tu-service-role-key>

# Cloudflare R2 (Storage de Multimedia)
R2_ACCOUNT_ID=<tu-account-id>
R2_ACCESS_KEY_ID=<tu-access-key-id>
R2_SECRET_ACCESS_KEY=<tu-secret-access-key>
R2_BUCKET_NAME=marketos-media
R2_PUBLIC_DOMAIN=https://assets.marketos.app

# APIs Externas
BCV_API_URL=https://bcv.today/api/

# Configuración de Tenant por Defecto
DEFAULT_TENANT_ID=shop-market-ca
DEFAULT_TENANT_NAME="Shop Market C.A."
DEFAULT_CURRENCY=USD
```

---

## 6. Checklist de Verificación para la Demo

- [ ] `apps/web/next.config.ts` tiene `images: { unoptimized: true }`.
- [ ] Ejecutado localmente `pnpm verify` para certificar que Supabase y Cloudflare R2 responden en verde.
- [ ] Proyecto `marketos-web` creado en Vercel apuntando a `apps/web`.
- [ ] Proyecto `marketos-admin` creado en Vercel apuntando a `apps/admin`.
- [ ] Comprobado en Vercel Dashboard que `Image Optimization` se mantiene estable y no sube drásticamente.
- [ ] Dominio o subdominio temporal listo para compartir con el prospecto del market.

---

## 7. Checklist para el Día del Lanzamiento (Paso a Pro)

- [ ] Cerrado el primer contrato comercial con el comercio/market.
- [ ] Actualizar plan en Vercel a **Pro ($20/mes)**.
- [ ] Ir a **Settings > Billing > Spend Management** y fijar el Hard Cap en **$20 - $25**.
- [ ] Asignar dominio comercial definitivo (ej. `mitienda.com` o `admin.mitienda.com`).
- [ ] Configurar el cron de sincronización de tasa BCV en Supabase Edge Functions.
