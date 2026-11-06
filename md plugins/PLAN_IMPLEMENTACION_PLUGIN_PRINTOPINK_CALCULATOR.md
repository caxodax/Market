# 📐 Plan de Implementación Maestro: Plugin `@marketos/plugin-printopink-calculator`

> **Documento Normativo**: Especificación Técnica y Plan de Ejecución  
> **Versión**: 1.0.0-production  
> **Aislamiento**: 100% Desacoplado de `@marketos/plugin-craft-workshop` (Cero mezclas, cero dependencias cruzadas)  
> **Biblia de Referencia**: `AI_RULES.md` (Leyes 1 a 5), `MARKETOS_MODULAR_ARCHITECTURE.md`, `DATABASE.md`  
> **Origen del Modelo de Costeo**: Documento Oficial *"Guía Completa de Costos y Estructura de Precios (PrintoPink)"*  

---

## 🛡️ 1. Blindaje Técnico y Observaciones Críticas del Auditor

Para garantizar una ejecución limpia que supere con éxito `pnpm check-types` y `pnpm test` sin advertencias ni regresiones, el desarrollo se rige por estas 4 directivas obligatorias:

1. **Control Secuencial de Migraciones SQL**:
   * La última migración consolidada en el monorepo es `00034_decouple_core_rpcs.sql`.
   * La migración de este nuevo módulo se nombrará estrictamente:
     `packages/database/supabase/migrations/00035_printopink_calculator_plugin.sql`.
2. **Alcance de Caché y Revalidación Estricta Multi-Tenant (Ley 3.2)**:
   * Toda invalidación de caché en Server Actions utilizará etiquetas aisladas por comercio:
     ```typescript
     revalidateTag(`tenant:${targetTenantId}:printopink`);
     ```
   * Queda estrictamente prohibido usar tags globales o purgas indiscriminadas.
3. **Inmutabilidad de Presets de Fábrica**:
   * Las 5 plantillas maestras del documento se definirán como constantes inmutables de solo lectura (`as const` / `Readonly<PrintopinkPreset[]>`) en `src/presets/printopink-presets.ts`.
   * Sirven como semilla de carga instantánea en la interfaz pero el artesano puede modificar cualquier valor en tiempo real sin alterar la plantilla base.
4. **Sincronización Documental Obligatoria en el Mismo Commit (Ley 5.3)**:
   * Al culminar la implementación, se actualizarán en el mismo commit de entrega:
     - `DATABASE.md` (con las tablas `printopink_calculations` y `printopink_quotes`).
     - `MARKETOS_MODULAR_ARCHITECTURE.md` (registrando el plugin 14 en la tabla oficial).
     - `ARCHITECTURE.md` (diagrama de módulos).

---

## 📊 2. Modelo Matemático: La Tríada del Costo Real

El plugin abandona abstracciones de software complejas y adopta el flujo de pensamiento de taller reflejado en la guía:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      COSTO TOTAL DE PRODUCCIÓN                         │
│                                                                        │
│   ┌────────────────────┐   ┌───────────────────┐   ┌───────────────┐   │
│   │ Materiales         │ + │ Desgaste Máquinas │ + │ Mano de Obra  │   │
│   │ Directos           │   │ + Luz             │   │ (Tu Sueldo)   │   │
│   └────────────────────┘   └───────────────────┘   └───────────────┘   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        RENTABILIDAD Y PRECIO                           │
│                                                                        │
│   PVP Sugerido = Costo Total × (1 + Margen % / 100)                    │
│   Ganancia Neta Libre = PVP - Costo Total de Producción                │
│   Anticipo Requerido = 50% del Total de la Orden                      │
└────────────────────────────────────────────────────────────────────────┘
```

* **Separación Sueldo vs Ganancia:** La mano de obra (\$0.12 a \$3.50) remunera el tiempo del artesano como un costo fijo. La ganancia neta es el beneficio libre para la empresa.
* **Depreciación Real:** Fondo de amortización para plotter **Cameo 5**, prensa térmica, impresora y laminadora.

---

## 🗂️ 3. Catálogo de Presets Precargados (Fidelidad 100% al PDF)

| Preset | Insumos Directos Base | Desgaste Máquina | Mano de Obra | Costo Producción | PVP Sugerido | Ganancia Neta |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Etiquetas Adhesivas** | Papel Foto (\$0.30) + Tinta (\$0.25) = \$0.55 | \$0.05 | \$0.60 | **\$1.20** | **\$1.80** | **+\$0.60** (33%) |
| **2. Impresión Negro (Texto)** | Papel (\$0.012) + Tinta (\$0.02) = \$0.032 | \$0.05 | \$0.30 | **\$0.38** | **\$0.60** | **+\$0.22** (37%) |
| **2. Impresión Color (Doc)** | Papel (\$0.012) + Tinta (\$0.10) = \$0.112 | \$0.05 | \$0.60 | **\$0.76** | **\$1.20** | **+\$0.44** (37%) |
| **3. Plastificado Carnet** | Lámina 100 mic (\$0.08) | \$0.03 | \$0.12 | **\$0.23** | **\$0.75** (indiv.) | **+\$0.52** (69%) |
| **4. Estampado Vinil (1 Lado)** | Vinil 1/4m (\$1.87) + Tinta (\$0.35) = \$2.22 | \$0.40 | \$2.00 (Depilado) | **\$4.62** | **\$9.00** | **+\$4.38** (49%) |
| **4. Estampado Vinil (2 Lados)**| Vinil 1/2m (\$3.75) + Tinta (\$0.70) = \$4.45 | \$0.80 | \$3.50 (Depilado) | **\$8.75** | **\$16.00** | **+\$7.25** (45%) |
| **4. Sublimación Directa (1 L)**| Papel (\$0.15) + Tinta (\$0.25) = \$0.40 | \$0.25 | \$0.50 | **\$1.15** | **\$4.00** | **+\$2.85** (71%) |
| **4. Sublimación Directa (2 L)**| Papel (\$0.30) + Tinta (\$0.50) = \$0.80 | \$0.45 | \$0.90 | **\$2.15** | **\$7.00** | **+\$4.85** (69%) |
| **5. Cajas Glasse (1 a 4 Hojas)**| Papel Glasse (\$0.13/hoja) + Tinta + Cameo | Incluido | Escalonada | **\$0.63 - \$2.52** | **\$1.50 - \$4.50** | **+\$0.87 - \$1.98** |
| **5. Cajas Opalina (1 a 4 Hojas)**| Cartulina Opalina (\$0.17/hoja) + Tinta + Cameo | Incluido | Escalonada | **\$0.67 - \$2.68** | **\$1.75 - \$5.00** | **+\$1.08 - \$2.32** |

> **Regla Especial de Cajas:** Toggle *"Sin Impresión (Cartulina Limpia)"* resta automáticamente **-\$0.25 por hoja** al costo total.

---

## 🗄️ 4. Base de Datos: Migración `00035_printopink_calculator_plugin.sql`

```sql
-- packages/database/supabase/migrations/00035_printopink_calculator_plugin.sql

CREATE TABLE IF NOT EXISTS public.printopink_calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    preset_category TEXT NOT NULL DEFAULT 'custom',
    materials_cost_base NUMERIC(12,4) NOT NULL DEFAULT 0,
    machinery_cost_base NUMERIC(12,4) NOT NULL DEFAULT 0,
    labor_cost_base NUMERIC(12,4) NOT NULL DEFAULT 0,
    waste_percentage NUMERIC(6,2) NOT NULL DEFAULT 0,
    total_cost_base NUMERIC(12,4) NOT NULL DEFAULT 0,
    selling_price_base NUMERIC(12,4) NOT NULL DEFAULT 0,
    wholesale_price_base NUMERIC(12,4),
    net_profit_base NUMERIC(12,4) NOT NULL DEFAULT 0,
    margin_percentage NUMERIC(6,2) NOT NULL DEFAULT 0,
    materials_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.printopink_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    quote_number TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    total_base NUMERIC(12,4) NOT NULL DEFAULT 0,
    deposit_required_base NUMERIC(12,4) NOT NULL DEFAULT 0,
    pending_balance_base NUMERIC(12,4) NOT NULL DEFAULT 0,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Zero-Trust
ALTER TABLE public.printopink_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printopink_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_printopink_calculations"
ON public.printopink_calculations
FOR ALL
USING (tenant_id = current_setting('app.current_tenant_id', true))
WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY "tenant_isolation_printopink_quotes"
ON public.printopink_quotes
FOR ALL
USING (tenant_id = current_setting('app.current_tenant_id', true))
WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- Índices de Rendimiento
CREATE INDEX IF NOT EXISTS idx_printopink_calc_tenant ON public.printopink_calculations (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_printopink_quotes_tenant ON public.printopink_quotes (tenant_id, created_at DESC);

-- Activación Idempotente del Módulo para PrintoPink
INSERT INTO public.tenant_modules (tenant_id, module_id, is_active, enabled_at)
VALUES ('printopink', 'printopink_calculator', true, NOW())
ON CONFLICT (tenant_id, module_id) DO UPDATE SET is_active = true, updated_at = NOW();
```

---

## 📦 5. Estructura de Paquetes y Archivos Nuevos

```
Market/
├── md plugins/
│   └── PLAN_IMPLEMENTACION_PLUGIN_PRINTOPINK_CALCULATOR.md
├── packages/
│   ├── types/
│   │   └── src/
│   │       ├── modules.ts                        # Registro de 'printopink_calculator'
│   │       └── printopink.ts                     # Interfaces tipadas estrictas
│   ├── database/
│   │   ├── supabase/migrations/
│   │   │   └── 00035_printopink_calculator_plugin.sql
│   │   └── src/repositories/
│   │       └── printopink-calculator.repository.ts
│   └── plugins/
│       └── printopink-calculator/
│           ├── package.json                      # @marketos/plugin-printopink-calculator
│           ├── tsconfig.json
│           └── src/
│               ├── manifest.ts                   # Metadatos del módulo
│               ├── presets/
│               │   └── printopink-presets.ts     # 5 Presets inmutables readonly
│               ├── services/
│               │   ├── pricing-engine.ts         # Funciones puras de costeo y abono 50%
│               │   └── pricing-engine.test.ts    # 100% test coverage con Vitest
│               ├── components/
│               │   ├── PrintopinkCalculator.tsx  # Vista interactiva 50/50 y mobile-first
│               │   ├── PrintopinkQuoteBuilder.tsx# Espejo WhatsApp y cálculo de abono 50%
│               │   ├── PrintopinkCatalogView.tsx # Tarjetas de fichas guardadas
│               │   └── PrintopinkAdminPanel.tsx  # Contenedor con tabs limpias
│               └── index.ts                      # Barrel export
└── apps/web/
    └── src/
        ├── app/admin/
        │   ├── printopink-actions.ts             # Server Actions protegidas con HMAC & RLS
        │   └── printopink-calculator/
        │       ├── page.tsx                      # Ruta dedicada con assertTenantModuleActive
        │       └── loading.tsx                   # Skeleton de carga (CLS = 0)
        └── components/
            └── admin-sidebar.tsx                 # Enlace condicional con icono Calculator
```

---

## 🚀 6. Fases de Ejecución Atómica

### Bloque 1: Contrato de Tipos & Base de Datos (Seguridad & Migración)
* [ ] Crear migración `00035_printopink_calculator_plugin.sql`.
* [ ] Registrar `'printopink_calculator'` en `packages/types/src/modules.ts`.
* [ ] Crear `packages/types/src/printopink.ts` con todos los contratos de cálculo y cotización.

### Bloque 2: Paquete Autónomo `@marketos/plugin-printopink-calculator`
* [ ] Inicializar `package.json` y `tsconfig.json`.
* [ ] Crear `src/manifest.ts` con `PRINTOPINK_CALCULATOR_MANIFEST`.
* [ ] Crear `src/presets/printopink-presets.ts` con las 5 plantillas inmutables del PDF.
* [ ] Desarrollar `src/services/pricing-engine.ts` y su suite de tests en `pricing-engine.test.ts`.
* [ ] Ejecutar `pnpm --filter @marketos/plugin-printopink-calculator test` (Verificar 100% pass).

### Bloque 3: Repositorio & Server Actions Protegidas
* [ ] Crear `packages/database/src/repositories/printopink-calculator.repository.ts`.
* [ ] Crear `apps/web/src/app/admin/printopink-actions.ts` con:
  - `resolveAuthorizedAdminContext()`
  - `assertTenantModuleActive(targetTenantId, "printopink_calculator")`
  - `revalidateTag(\`tenant:\${targetTenantId}:printopink\`)`

### Bloque 4: Componentes Visuales & App Router
* [ ] Crear `PrintopinkCalculator.tsx` con simetría 50/50, selector de presets de 1 clic, pills de ajuste rápido y ticket financiero en vivo.
* [ ] Crear `PrintopinkQuoteBuilder.tsx` con espejo de mensaje para WhatsApp y 50% de anticipo.
* [ ] Crear `PrintopinkAdminPanel.tsx` con navegación por sub-pestañas.
* [ ] Implementar `apps/web/src/app/admin/printopink-calculator/page.tsx` y `loading.tsx`.
* [ ] Conectar en `AdminSidebar` condicionado al módulo activo.

### Bloque 5: Verificación Integral & Sincronización Documental
* [ ] Ejecutar `pnpm -r check-types` (0 errores en los 21 paquetes).
* [ ] Ejecutar `pnpm test` (suite completa en verde).
* [ ] Actualizar `DATABASE.md`, `MARKETOS_MODULAR_ARCHITECTURE.md` y `ARCHITECTURE.md`.
* [ ] Subir commits limpios al repositorio.
