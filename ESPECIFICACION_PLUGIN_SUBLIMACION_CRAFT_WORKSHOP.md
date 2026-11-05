# 🎨 ESPECIFICACIÓN TÉCNICA Y DE NEGOCIO: PLUGIN CRAFT WORKSHOP (SUBLIMACIÓN & ARTES GRÁFICAS)
**MarketOS Multi-Tenant Platform — Vertical de Personalización y Manufactura Liviana**  
**Fecha de Actualización:** 5 de Noviembre de 2026  
**Identificador del Plugin:** `craft_workshop`  
**Paquete:** `@marketos/plugin-craft-workshop`  
**Estado:** ESPECIFICACIÓN TÉCNICA DEFINITIVA (Aprobada Arquitectónicamente — Lista para Fase 1)  
**Alcance:** Aislamiento 100% Multi-Tenant por `tenant_id` para Printopink y cualquier taller actual o futuro de sublimación, DTF, vinil, papelería y manualidades.

---

## 1. Visión General y Propósito del Plugin

### 1.1 El Problema que Resuelve
En talleres de personalización, sublimación, artes gráficas y manualidades (como **Printopink**), los productos terminados no se compran ya hechos para reventa simple; **se fabrican y ensamblan bajo demanda combinando múltiples insumos comprados al mayor (bultos, cajas, resmas, rollos)**.

Actualmente, los comercios enfrentan cinco dolores operativos críticos:
1. **Dificultad para calcular el costo unitario real:** Si una caja de 36 tazas cuesta $60.00, una resma de 100 hojas cuesta $10.00 y un rollo de cinta térmica cuesta $3.00, calcular manualmente el costo exacto por unidad de cada insumo utilizado en una taza personalizada induce a errores humanos y pérdidas de dinero.
2. **Pérdida por Merma y Fallos de Taller:** En sublimación, vinil y DTF se pierden piezas por presión inadecuada, fallos térmicos, pelado incorrecto o atascos de papel. No incluir un porcentaje técnico de merma hace que las mermas salgan del bolsillo del dueño.
3. **Omisión de Mano de Obra y Desgaste de Máquina:** En manualidades (esferas navideñas, toppers, papelería troquelada), el material puede costar $0.50, pero el armado manual y corte toma 25 minutos. Cobrar solo margen sobre material es trabajar a pérdida.
4. **Ventas a pérdida por inflación de insumos:** Si el proveedor sube el costo de la caja de tazas o del papel, el comercio no sabe cuáles productos se ven afectados y sigue vendiendo a precio viejo.
5. **Lentitud para cotizar por WhatsApp y exigir anticipo:** Cuando un cliente pide un combo personalizado (ej. 12 tazas + 24 esferas + envío), el taller tarda en calcular, no formaliza el anticipo estándar del 50% y tiene que reescribir manualmente la orden cuando el cliente paga.

### 1.2 La Solución de MarketOS (`craft_workshop`)
Un ERP vertical modular de manufactura y cotizaciones que provee:
1. **Catálogo Maestro de Insumos / Materia Prima:** Compras por paquete/bulto con cálculo automático del costo unitario.
2. **Escandallos / Recetas Técnicas Normalizadas:** Renglones relacionales (`craft_recipe_items`) con checkboxes interactivos, merma técnica y costo de mano de obra/máquina.
3. **Doble Nivel de Precios:** Precio detal y precio al mayor (+12 / +36 unidades) en la misma receta.
4. **Alerta de Inflación y Recálculo Atómico en Base de Datos:** RPC en PostgreSQL (`rpc_recalculate_craft_recipes`) que en < 5 ms actualiza todas las recetas afectadas por un cambio de insumo y actualiza tanto `price` como `cost_price` en el catálogo de MarketOS.
5. **Cotizador Rápido con Anticipo del 50% para WhatsApp:** Generación de mensajes estructurados con monto exacto de abono en divisas y bolívares (tasa oficial), más conversión directa a pedido (`orders`) con 1 clic.

---

## 2. Coherencia Arquitectónica y Gobernanza (ECC Ultra & AgentShield)

### 2.1 Frontera Estricta entre `craft_workshop` y `mto_cpq`
Para evitar redundancias en comercios como Printopink:
* **`craft_workshop` (Backoffice / ERP Interno de Taller):**  
  Herramienta exclusiva del **administrador y operario de taller**. Sirve para registrar insumos maestros, costear recetas técnicas con mermas y mano de obra, visualizar ganancias netas, recibir alertas de inflación y cotizar ventas personalizadas por WhatsApp.
* **`mto_cpq` (Frontend Público / Vitrina Interactiva):**  
  Herramienta opcional orientada al **cliente final en la web**. Si el cliente entra al storefront público y requiere un configurador dimensional interactivo (ancho $\times$ alto para letreros o pendones), interviene este módulo.
* **Puente de Conexión:** Cuando una receta se publica (`is_published = true`), se sincroniza directamente en la tabla nativa `products`. No existe dependencia cruzada entre plugins.

### 2.2 Modelo Bimonetario Universal (`_base` y `_secondary`)
En cumplimiento con la **Fase 1 y Prioridad 8 de MarketOS**:
* Todos los campos de dinero usan sufijos agnósticos: `_base` (moneda primaria del tenant: USD, EUR, etc.) y `_secondary` (moneda secundaria: VES).
* Las cotizaciones se calculan aplicando `exchange_rate_applied` desde la tabla `tenants`, permitiendo alternar regímenes cambiarios (BCV oficial, BCV promedio, custom) sin alterar el código del plugin.

### 2.3 Aislamiento Multi-Tenant y Seguridad RLS
* Todas las tablas incluyen `tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE`.
* Políticas de Row Level Security (RLS) impiden de forma absoluta cualquier fuga de información entre diferentes comercios de sublimación.

---

## 3. Esquema de Base de Datos Definitivo (PostgreSQL / Supabase DDL)

```sql
-- =====================================================================
-- PLUGIN: CRAFT WORKSHOP (SUBLIMACIÓN, DTF, VINIL & PAPELERÍA)
-- Migration: 00033_craft_workshop_plugin.sql
-- Compatible con Modelo Bimonetario y Arquitectura RPC MarketOS
-- =====================================================================

-- 0. EXTENDER TABLA PRODUCTS PARA SOPORTAR COST_PRICE DE CONTABILIDAD
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2) DEFAULT NULL;

-- 1. CATÁLOGO MAESTRO DE INSUMOS / MATERIA PRIMA
CREATE TABLE IF NOT EXISTS public.craft_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'sublimacion', 
    -- Valores: 'sublimacion', 'dtf', 'vinil', 'papeleria', 'esferas', 'empaque', 'envio', 'general'
    sku TEXT,
    pack_quantity NUMERIC(12, 3) NOT NULL DEFAULT 1 CHECK (pack_quantity > 0),
    pack_price_base NUMERIC(12, 2) NOT NULL DEFAULT 0, -- En moneda base del tenant (USD/EUR)
    unit_cost_base NUMERIC(12, 4) GENERATED ALWAYS AS (
        pack_price_base / pack_quantity
    ) STORED,
    unit_measure TEXT NOT NULL DEFAULT 'UNIDAD', -- 'UNIDAD', 'HOJA', 'METRO', 'CM2', 'ML', 'GRAMO', 'USO'
    stock_packs NUMERIC(12, 3) NOT NULL DEFAULT 0,
    min_stock_packs NUMERIC(12, 3) NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_craft_materials_tenant_cat 
ON public.craft_materials (tenant_id, category, is_active);

-- 2. CABECERA DE RECETAS / ESCANDALLOS TÉCNICOS
CREATE TABLE IF NOT EXISTS public.craft_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT,
    technique TEXT NOT NULL DEFAULT 'sublimacion',
    category_name TEXT DEFAULT 'General',
    -- Costos operativos reales de taller
    materials_cost_base NUMERIC(12, 2) NOT NULL DEFAULT 0,
    waste_percentage NUMERIC(5, 2) NOT NULL DEFAULT 5.00, -- % Merma (fallos de calor/corte/pelado)
    labor_cost_base NUMERIC(12, 2) NOT NULL DEFAULT 0,    -- Mano de obra / desgaste de plancha/plotter
    direct_cost_base NUMERIC(12, 2) GENERATED ALWAYS AS (
        ROUND((materials_cost_base * (1 + (waste_percentage / 100.0))) + labor_cost_base, 2)
    ) STORED,
    pricing_formula TEXT NOT NULL DEFAULT 'MARGIN', -- 'MARGIN' (sobre venta) | 'MARKUP' (sobre costo)
    margin_percentage NUMERIC(5, 2) NOT NULL DEFAULT 30.00,
    selling_price_base NUMERIC(12, 2) NOT NULL DEFAULT 0,
    wholesale_price_base NUMERIC(12, 2) DEFAULT NULL, -- Precio al mayor opcional (ej. +12 uds)
    profit_base NUMERIC(12, 2) GENERATED ALWAYS AS (
        selling_price_base - ROUND((materials_cost_base * (1 + (waste_percentage / 100.0))) + labor_cost_base, 2)
    ) STORED,
    has_pending_recalc BOOLEAN NOT NULL DEFAULT false, -- Flag automático si sube un insumo
    is_published BOOLEAN NOT NULL DEFAULT false,
    product_id UUID NULL REFERENCES public.products(id) ON DELETE SET NULL,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_craft_recipes_tenant 
ON public.craft_recipes (tenant_id, technique, is_active);

-- 3. RENGLONES DE INSUMOS POR RECETA (Relacional + Rápido para Recálculo en Cascada)
CREATE TABLE IF NOT EXISTS public.craft_recipe_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    recipe_id UUID NOT NULL REFERENCES public.craft_recipes(id) ON DELETE CASCADE,
    material_id UUID NULL REFERENCES public.craft_materials(id) ON DELETE SET NULL,
    custom_name TEXT NOT NULL, -- Nombre del insumo (sincronizado o libre)
    pack_qty_snapshot NUMERIC(12, 3) NOT NULL DEFAULT 1,
    pack_price_snapshot NUMERIC(12, 2) NOT NULL DEFAULT 0,
    unit_cost_snapshot NUMERIC(12, 4) NOT NULL DEFAULT 0,
    qty_to_use NUMERIC(12, 4) NOT NULL DEFAULT 1,
    cost_used_base NUMERIC(12, 4) GENERATED ALWAYS AS (unit_cost_snapshot * qty_to_use) STORED,
    is_checked BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_craft_recipe_items_recipe ON public.craft_recipe_items (recipe_id);
CREATE INDEX IF NOT EXISTS idx_craft_recipe_items_material ON public.craft_recipe_items (material_id);

-- 4. COTIZACIONES RÁPIDAS PARA WHATSAPP CON ANTICIPO Y CONVERSIÓN A ORDEN
CREATE TABLE IF NOT EXISTS public.craft_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    quote_number TEXT NOT NULL, -- ej. "COT-00124"
    customer_name TEXT,
    customer_phone TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    shipping_notes TEXT,
    shipping_cost_base NUMERIC(12, 2) NOT NULL DEFAULT 0,
    subtotal_base NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_base NUMERIC(12, 2) NOT NULL DEFAULT 0,
    base_currency TEXT NOT NULL DEFAULT 'USD',
    exchange_rate_applied NUMERIC(14, 4) NOT NULL DEFAULT 1,
    total_secondary NUMERIC(14, 2) NOT NULL DEFAULT 0, -- Equivalente en Bs.
    deposit_percentage NUMERIC(5, 2) NOT NULL DEFAULT 50.00, -- 50% abono estándar en sublimación
    deposit_required_base NUMERIC(12, 2) GENERATED ALWAYS AS (
        ROUND(total_base * (deposit_percentage / 100.0), 2)
    ) STORED,
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'sent_whatsapp', 'converted_to_order'
    converted_order_id UUID NULL REFERENCES public.orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, quote_number)
);

CREATE INDEX IF NOT EXISTS idx_craft_quotes_tenant 
ON public.craft_quotes (tenant_id, created_at DESC);

-- 5. POLÍTICAS ROW LEVEL SECURITY (RLS)
ALTER TABLE public.craft_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.craft_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.craft_recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.craft_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for craft_materials"
ON public.craft_materials FOR ALL
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

CREATE POLICY "Tenant isolation for craft_recipes"
ON public.craft_recipes FOR ALL
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

CREATE POLICY "Tenant isolation for craft_recipe_items"
ON public.craft_recipe_items FOR ALL
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

CREATE POLICY "Tenant isolation for craft_quotes"
ON public.craft_quotes FOR ALL
USING (tenant_id = public.current_user_tenant_id() OR public.is_super_admin());

-- 6. RPC ATÓMICO: RECALCULAR TODAS LAS RECETAS AL SUBIR PRECIOS DE INSUMOS
CREATE OR REPLACE FUNCTION public.rpc_recalculate_craft_recipes(
    p_tenant_id TEXT,
    p_sync_storefront BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated_recipes INT := 0;
    v_synced_products INT := 0;
BEGIN
    -- 1. Actualizar snapshots de costos en los renglones vinculados a insumos maestros
    UPDATE public.craft_recipe_items cri
    SET 
        pack_qty_snapshot = cm.pack_quantity,
        pack_price_snapshot = cm.pack_price_base,
        unit_cost_snapshot = cm.unit_cost_base
    FROM public.craft_materials cm
    WHERE cri.material_id = cm.id
      AND cri.tenant_id = p_tenant_id
      AND cm.tenant_id = p_tenant_id;

    -- 2. Recalcular costo de materiales y nuevo precio sugerido en cada receta del tenant
    WITH recipe_sums AS (
        SELECT 
            recipe_id,
            COALESCE(SUM(CASE WHEN is_checked THEN unit_cost_snapshot * qty_to_use ELSE 0 END), 0) AS new_mat_cost
        FROM public.craft_recipe_items
        WHERE tenant_id = p_tenant_id
        GROUP BY recipe_id
    )
    UPDATE public.craft_recipes cr
    SET 
        materials_cost_base = ROUND(rs.new_mat_cost, 2),
        selling_price_base = CASE 
            WHEN cr.pricing_formula = 'MARGIN' AND cr.margin_percentage < 100 THEN
                ROUND(
                    ((rs.new_mat_cost * (1 + (cr.waste_percentage / 100.0))) + cr.labor_cost_base) 
                    / (1.0 - (cr.margin_percentage / 100.0)), 
                2)
            ELSE
                ROUND(
                    ((rs.new_mat_cost * (1 + (cr.waste_percentage / 100.0))) + cr.labor_cost_base) 
                    * (1.0 + (cr.margin_percentage / 100.0)), 
                2)
        END,
        has_pending_recalc = false,
        updated_at = NOW()
    FROM recipe_sums rs
    WHERE cr.id = rs.recipe_id
      AND cr.tenant_id = p_tenant_id;

    GET DIAGNOSTICS v_updated_recipes = ROW_COUNT;

    -- 3. Si el usuario solicitó sincronizar precios y costos con el catálogo público (products)
    IF p_sync_storefront THEN
        UPDATE public.products p
        SET 
            price_usd = cr.selling_price_base,
            cost_price = cr.direct_cost_base,
            updated_at = NOW()
        FROM public.craft_recipes cr
        WHERE cr.product_id = p.id
          AND cr.tenant_id = p_tenant_id
          AND p.tenant_id = p_tenant_id
          AND cr.is_published = true;

        GET DIAGNOSTICS v_synced_products = ROW_COUNT;
    END IF;

    RETURN jsonb_build_object(
        'updated_recipes', v_updated_recipes,
        'synced_products', v_synced_products
    );
END;
$$;

-- 7. TRIGGER: ALERTA DE INFLACIÓN (MARCAR has_pending_recalc AL VARIAR PRECIO DE INSUMO)
CREATE OR REPLACE FUNCTION public.fn_flag_recipes_on_material_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.pack_price_base IS DISTINCT FROM OLD.pack_price_base 
       OR NEW.pack_quantity IS DISTINCT FROM OLD.pack_quantity THEN
        UPDATE public.craft_recipes cr
        SET has_pending_recalc = true,
            updated_at = NOW()
        FROM public.craft_recipe_items cri
        WHERE cri.recipe_id = cr.id
          AND cri.material_id = NEW.id
          AND cr.tenant_id = NEW.tenant_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_craft_material_price_change ON public.craft_materials;
CREATE TRIGGER trg_craft_material_price_change
AFTER UPDATE OF pack_price_base, pack_quantity ON public.craft_materials
FOR EACH ROW
EXECUTE FUNCTION public.fn_flag_recipes_on_material_price_change();
```

---

## 4. Fórmulas Matemáticas y Motor de Costeo

### 4.1 Costeo de Insumos Fraccionados
$$\text{Costo Unitario Base} = \frac{\text{Precio del Paquete Base}}{\text{Cantidad del Paquete}}$$

$$\text{Costo Insumo Utilizado Base} = \text{Costo Unitario Base} \times \text{Cantidad a Utilizar}$$

### 4.2 Costo Directo Total (Con Merma y Mano de Obra)
$$\text{Costo Materiales Activos} = \sum_{i \in \text{Insumos Marcados}} \text{Costo Insumo Utilizado}_i$$

$$\text{Costo Directo Base} = \text{ROUND}\left( \left(\text{Costo Materiales} \times \left(1 + \frac{\text{Merma \%}}{100}\right)\right) + \text{Mano de Obra / Máquina}, \, 2 \right)$$

### 4.3 Determinación del Precio de Venta
* **Fórmula Margen sobre Venta (`MARGIN`):**
  $$\text{Precio Venta Base} = \frac{\text{Costo Directo Base}}{1 - (\text{Margen \%} / 100)}$$
  *Ejemplo Taza Sublimada:*
  * Materiales: $\$2.80$
  * Merma ($5\%$): $\$2.80 \times 1.05 = \$2.94$
  * Mano de obra/plancha: $\$0.20$
  * Costo Directo Base: $\$3.14$
  * Margen comercial deseado: $28.6\%$
  * Precio Venta: $\frac{3.14}{1 - 0.286} = \frac{3.14}{0.714} = \mathbf{\$4.40}$
  * Ganancia Neta: $\$4.40 - \$3.14 = \mathbf{\$1.26}$

* **Fórmula Margen sobre Costo (`MARKUP`):**
  $$\text{Precio Venta Base} = \text{Costo Directo Base} \times \left(1 + \frac{\text{Mark-up \%}}{100}\right)$$

---

## 5. Módulos y Técnicas Específicas de Taller

### 5.1 Sublimación (Tazas, Termos, Gorras, Mousepads)
* Insumo base: Taza 11oz blanca, taza mágica, vaso cónico, termo de acero.
* Consumibles: Papel de sublimación (hoja A4/A3), tinta de sublimación, cinta térmica, protector teflón.
* Acabado: Caja individual con ventana, lazo decorativo.
* Merma típica recomendada: $5.00\%$.

### 5.2 DTF Textil (Direct-to-Film)
* Sustrato base: Franela poliéster/algodón, suéter hoodie, gorra, tote bag.
* Consumibles: Film DTF por metro lineal o pliego (A3/A4), tinta CMYK + tinta blanca, poliamida termotransferible.
* Máquina y Mano de Obra: Tiempo de curado y doble planchado térmico.
* Merma típica recomendada: $5.00\% - 8.00\%$.

### 5.3 Vinil (Corte Textil y Adhesivo)
* Sustrato base: Prenda textil, acrílico, lámina MDF, madera, vidrio.
* Consumibles: Metros lineales de vinil, factor de merma y descarte de corte, transfer tape (transportador).
* Mano de obra: Tiempo de pelado manual (weeding) y fijación.
* Merma típica recomendada: $10.00\%$.

### 5.4 Papelería Creativa & Etiquetas
* Sustratos: Pliego glasé 300g, papel fotográfico, papel opalina, papel adhesivo brillante/mate.
* Rendimiento por Pliego: Número de etiquetas/tarjetas aprovechables por pliego.
* Acabado: Laminado en frío (brillante, mate, holográfico) y corte en plotter/guillotina.

### 5.5 Esferas Navideñas & Manualidades
* Esfera base: Esfera plástica o acrílica transparente (6cm, 8cm, 10cm).
* Relleno: Nieve artificial, plumas, escarcha, confeti.
* Personalización: Vinil adhesivo troquelado con nombre o foto en acetato interno.
* Lazo y Colgante: Cinta terciopelo/raso, cordón metalizado.
* Mano de obra: Tiempo de armado minucioso (típicamente $15-25$ min por unidad).

### 5.6 Costos de Empaque
* Cajas individuales para tazas, cajas microcorrugadas para envíos, bolsas de celofán/kraft.
* Protección estética: Viruta de papel, papel seda con logo, stickers de cierre.

### 5.7 Costos de Logística y Envíos
* Embalaje de seguridad: Plástico de burbujas, anime/poliestireno, cartón rígido, precinto de seguridad.
* Flete: Delivery local en moto o tarifa nacional de encomienda (MRW, Zoom, Tealca).

---

## 6. Diseño UI/UX y Flujo Operativo en el Panel Admin

### 6.1 Vista 1: Catálogo de Costeo & Recetas (Ref. Imagen 1)
* **Barra de Herramientas:**
  * Buscador por nombre o SKU.
  * Selector de técnica (*Sublimación, DTF, Vinil, Papelería, Esferas, General*).
  * Botón **"+ Nueva Receta"**.
  * Botón con Badge Dinámico: **"🔄 Recalcular pendientes [X]"** (muestra en ámbar si `has_pending_recalc = true`).
* **Tarjetas de Producto Costeado:**
  * Icono de técnica + Nombre + SKU.
  * Desglose: Costo Directo, Precio Venta Detal, Precio Mayor (+12 uds), Ganancia Neta y Margen %.
  * Botón **"Publicar en Tienda Online"** (crea el producto en `products` o actualiza `price` y `cost_price` si ya existe).
  * Acciones: Editar, Duplicar, Eliminar.

### 6.2 Vista 2: Calculadora de Costos Directos (Ref. Imágenes 3 y 4)
* **Bloque de Insumos Activos:**
  * Tabla interactiva con checkboxes `[x]`.
  * Columnas: Insumo maestro, Cantidad paquete, Precio paquete, Costo unitario, Cantidad a usar, Costo utilizado.
  * Selector rápido para incorporar insumos de `craft_materials` o añadir un insumo libre.
* **Bloque de Parámetros de Taller:**
  * Campo de % Merma (por defecto $5.00\%$).
  * Campo de Mano de Obra / Desgaste de Máquina.
  * Selector de Fórmula: Margen sobre Venta (`MARGIN`) vs. Mark-up (`MARKUP`).
  * Slider de Margen Comercial (ej. 30%).
  * Input opcional de Precio al Mayor.
* **Resumen Financiero en Tiempo Real:**
  * Costo Materiales $\rightarrow$ (+) Merma $\rightarrow$ (+) Mano de Obra $\rightarrow$ **Costo Directo Final**.
  * Precio Sugerido y Ganancia Neta.
* **Acciones:**
  * `[Guardar Receta]`
  * `[Guardar y Sincronizar en Tienda Web]`

### 6.3 Vista 3: Cotizador Rápido con Anticipo y WhatsApp (Ref. Imagen 2)
* **Selector de Productos:**
  * Búsqueda en el catálogo de recetas con selector de cantidad (aplica precio al mayor automáticamente si supera el umbral).
  * Opción de añadir ítems libres no guardados (ej. "Diseño y vectorización de logo corporativo").
  * Checkbox de Embalaje Seguro y Flete de Envío.
* **Panel de Totales Bimonetario:**
  * Subtotal en divisa base ($ USD) y secundaria (Bs.).
  * Total General.
  * **Cálculo de Anticipo Requerido (50%):** Muestra el monto exacto para iniciar trabajo.
* **Cierre de Ventas:**
  * Botón `[Copiar Cotización]` (al portapapeles).
  * Botón verde `[📲 Enviar por WhatsApp]` (abre chat con mensaje formateado).
  * Botón `[Convertir en Pedido (Order)]`: Cuando el cliente envía el capture del 50%, genera el pedido en la tabla `orders` registrando el abono en `payments` sin transcripción manual.

---

## 7. Plantilla Oficial del Mensaje para WhatsApp

```text
📐 *COTIZACIÓN DE TALLER & PERSONALIZACIÓN*
🏢 *Printopink*
━━━━━━━━━━━━━━━━━━━━
👤 *Cliente:* [Nombre del Cliente]
📅 *Fecha:* 05/11/2026
🔢 *Presupuesto:* COT-00124
━━━━━━━━━━━━━━━━━━━━

📋 *DETALLE DE TU PEDIDO:*

1. *Taza Blanca 11oz con caja y lazo Dtal*
   • Cantidad: 12 unidades (Precio Mayor)
   • Precio unitario: $3.80
   • Subtotal: $45.60

2. *Esferas Navideñas Personalizadas con nieve y lazo*
   • Cantidad: 24 unidades
   • Precio unitario: $2.50
   • Subtotal: $60.00

3. *Embalaje Protector & Envío Nacional (MRW/Tealca)*
   • Subtotal: $4.50

━━━━━━━━━━━━━━━━━━━━
💰 *TOTAL PRESUPUESTO:*
💵 *$110.10 USD*
🇻🇪 *Bs. 5.505,00* (Tasa BCV oficial: 50,00)

🔒 *ABONO REQUERIDO 50% PARA INICIAR PRODUCCIÓN:*
👉 *$55.05 USD*  |  *Bs. 2.752,50*
━━━━━━━━━━━━━━━━━━━━
⏳ *Tiempo de Elaboración:* 2 a 3 días hábiles tras confirmar diseño y abono.
💳 *Datos para Abono:* Pago Móvil, Transferencia Bancaria, Zelle, Efectivo.

_Para confirmar tu pedido y coordinar los diseños, responde directamente a este mensaje con tu comprobante._
```

---

## 8. Integración con `rpc_create_order_atomic` (Descarga de Inventario)

Para evitar desfasajes de inventario cuando un producto publicado se vende en la tienda online o en el POS físico:
* En el Stored Procedure `rpc_create_order_atomic` (Migración 00030), se incorpora la evaluación de recetas artesanales:
```sql
-- Si el comercio tiene activo el módulo craft_workshop y vende un producto publicado:
IF v_has_craft_workshop = TRUE THEN
    WITH consumed AS (
        SELECT 
            cri.material_id,
            SUM(cri.qty_to_use * item_record.quantity) AS total_units_used
        FROM public.craft_recipe_items cri
        JOIN public.craft_recipes cr ON cr.id = cri.recipe_id
        WHERE cr.product_id = item_record.product_id
          AND cr.tenant_id = v_tenant_id
          AND cri.is_checked = true
          AND cri.material_id IS NOT NULL
        GROUP BY cri.material_id
    )
    UPDATE public.craft_materials cm
    SET stock_packs = GREATEST(0, ROUND(cm.stock_packs - (c.total_units_used / cm.pack_quantity), 3)),
        updated_at = NOW()
    FROM consumed c
    WHERE cm.id = c.material_id
      AND cm.tenant_id = v_tenant_id;
END IF;
```

---

## 9. Plan de Reversión (Rollback Plan)

Si por cualquier requerimiento operativo se desea anular o revertir el plugin:
1. **Reversión en Base de Datos (Supabase SQL):**
   ```sql
   DROP TRIGGER IF EXISTS trg_craft_material_price_change ON public.craft_materials;
   DROP FUNCTION IF EXISTS public.fn_flag_recipes_on_material_price_change();
   DROP FUNCTION IF EXISTS public.rpc_recalculate_craft_recipes(TEXT, BOOLEAN);
   DROP TABLE IF EXISTS public.craft_quotes CASCADE;
   DROP TABLE IF EXISTS public.craft_recipe_items CASCADE;
   DROP TABLE IF EXISTS public.craft_recipes CASCADE;
   DROP TABLE IF EXISTS public.craft_materials CASCADE;
   DELETE FROM public.tenant_modules WHERE module_id = 'craft_workshop';
   ```
2. **Reversión en Código:**
   * Remover el workspace `packages/plugins/craft-workshop`.
   * Los productos ya publicados en el catálogo general permanecen intactos en la tabla `products` sin causar fallos en la vitrina web ni en las órdenes existentes.

---
*Fin del documento de especificación integral actualizado.*
