import type {
  CraftMaterial,
  CraftMaterialCategory,
  CreateCraftMaterialInput,
  UpdateCraftMaterialInput,
  CraftRecipe,
  CraftRecipeItem,
  CreateCraftRecipeInput,
  UpdateCraftRecipeInput,
  WorkshopTechnique,
  CraftQuote,
  CreateCraftQuoteInput,
  CraftQuoteStatus,
  RecalculateCraftRecipesResult,
} from "@marketos/types";
import { getSupabase, generateUuid, isLiveDatabaseConfigured } from "./base.ts";
import { AuditRepository } from "./audit.repository.ts";

export class CraftWorkshopRepository {
  // =========================================================================
  // 1. INSUMOS MAESTROS / MATERIA PRIMA (craft_materials)
  // =========================================================================

  /**
   * Obtiene todos los insumos activos de un comercio con filtro opcional por categoría
   */
  static async getMaterials(
    tenantId: string,
    category?: CraftMaterialCategory
  ): Promise<CraftMaterial[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    try {
      let query = supabase
        .from("craft_materials")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (category && category !== "general") {
        query = query.eq("category", category);
      }

      const { data, error } = await query;
      if (error) {
        console.warn("[CraftWorkshopRepository] Error fetching materials:", error.message);
        return [];
      }

      return (data || []).map((m) => ({
        ...m,
        pack_quantity: Number(m.pack_quantity),
        pack_price_base: Number(m.pack_price_base),
        unit_cost_base: Number(m.unit_cost_base),
        stock_packs: Number(m.stock_packs || 0),
        min_stock_packs: Number(m.min_stock_packs || 1),
      })) as CraftMaterial[];
    } catch (err) {
      console.error("[CraftWorkshopRepository] getMaterials exception:", err);
      return [];
    }
  }

  /**
   * Obtiene un insumo por ID
   */
  static async getMaterialById(
    tenantId: string,
    materialId: string
  ): Promise<CraftMaterial | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from("craft_materials")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("id", materialId)
        .maybeSingle();

      if (error || !data) return null;

      return {
        ...data,
        pack_quantity: Number(data.pack_quantity),
        pack_price_base: Number(data.pack_price_base),
        unit_cost_base: Number(data.unit_cost_base),
        stock_packs: Number(data.stock_packs || 0),
        min_stock_packs: Number(data.min_stock_packs || 1),
      } as CraftMaterial;
    } catch {
      return null;
    }
  }

  /**
   * Registra un nuevo insumo maestro
   */
  static async createMaterial(
    input: CreateCraftMaterialInput
  ): Promise<CraftMaterial | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      const payload = {
        id: generateUuid(),
        tenant_id: input.tenantId,
        name: input.name.trim(),
        category: input.category,
        sku: input.sku?.trim() || null,
        pack_quantity: input.packQuantity,
        pack_price_base: input.packPriceBase,
        unit_measure: input.unitMeasure || "UNIDAD",
        stock_packs: input.stockPacks || 0,
        min_stock_packs: input.minStockPacks || 1,
        is_active: true,
      };

      const { data, error } = await supabase
        .from("craft_materials")
        .insert(payload)
        .select()
        .single();

      if (error || !data) {
        console.error("[CraftWorkshopRepository] Error creating material:", error?.message);
        return null;
      }

      await AuditRepository.recordAuditLog({
        tenantId: input.tenantId,
        action: "PRODUCT_CREATED",
        entity: "craft_materials",
        entityId: data.id,
        newData: data as Record<string, unknown>,
      });

      return {
        ...data,
        pack_quantity: Number(data.pack_quantity),
        pack_price_base: Number(data.pack_price_base),
        unit_cost_base: Number(data.unit_cost_base),
        stock_packs: Number(data.stock_packs || 0),
        min_stock_packs: Number(data.min_stock_packs || 1),
      } as CraftMaterial;
    } catch (err) {
      console.error("[CraftWorkshopRepository] createMaterial exception:", err);
      return null;
    }
  }

  /**
   * Actualiza un insumo maestro
   */
  static async updateMaterial(
    input: UpdateCraftMaterialInput
  ): Promise<CraftMaterial | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (input.name !== undefined) updates.name = input.name.trim();
      if (input.category !== undefined) updates.category = input.category;
      if (input.sku !== undefined) updates.sku = input.sku?.trim() || null;
      if (input.packQuantity !== undefined) updates.pack_quantity = input.packQuantity;
      if (input.packPriceBase !== undefined) updates.pack_price_base = input.packPriceBase;
      if (input.unitMeasure !== undefined) updates.unit_measure = input.unitMeasure;
      if (input.stockPacks !== undefined) updates.stock_packs = input.stockPacks;
      if (input.minStockPacks !== undefined) updates.min_stock_packs = input.minStockPacks;
      if (input.isActive !== undefined) updates.is_active = input.isActive;

      const { data, error } = await supabase
        .from("craft_materials")
        .update(updates)
        .eq("tenant_id", input.tenantId)
        .eq("id", input.materialId)
        .select()
        .single();

      if (error || !data) {
        console.error("[CraftWorkshopRepository] Error updating material:", error?.message);
        return null;
      }

      return {
        ...data,
        pack_quantity: Number(data.pack_quantity),
        pack_price_base: Number(data.pack_price_base),
        unit_cost_base: Number(data.unit_cost_base),
        stock_packs: Number(data.stock_packs || 0),
        min_stock_packs: Number(data.min_stock_packs || 1),
      } as CraftMaterial;
    } catch (err) {
      console.error("[CraftWorkshopRepository] updateMaterial exception:", err);
      return null;
    }
  }

  /**
   * Eliminación lógica (is_active: false) de un insumo
   */
  static async deleteMaterial(tenantId: string, materialId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;

    try {
      const { error } = await supabase
        .from("craft_materials")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("id", materialId);

      return !error;
    } catch {
      return false;
    }
  }

  // =========================================================================
  // 2. RECETAS / ESCANDALLOS TÉCNICOS (craft_recipes + craft_recipe_items)
  // =========================================================================

  /**
   * Obtiene todas las recetas de un taller con sus renglones relacionales
   */
  static async getRecipes(
    tenantId: string,
    options?: { technique?: WorkshopTechnique; isActive?: boolean }
  ): Promise<CraftRecipe[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    try {
      let query = supabase
        .from("craft_recipes")
        .select("*, items:craft_recipe_items(*)")
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true });

      if (options?.isActive !== undefined) {
        query = query.eq("is_active", options.isActive);
      } else {
        query = query.eq("is_active", true);
      }

      if (options?.technique && options.technique !== "general") {
        query = query.eq("technique", options.technique);
      }

      const { data, error } = await query;
      if (error) {
        console.warn("[CraftWorkshopRepository] Error fetching recipes:", error.message);
        return [];
      }

      return (data || []).map((r) => ({
        ...r,
        materials_cost_base: Number(r.materials_cost_base),
        waste_percentage: Number(r.waste_percentage),
        labor_cost_base: Number(r.labor_cost_base),
        direct_cost_base: Number(r.direct_cost_base),
        margin_percentage: Number(r.margin_percentage),
        selling_price_base: Number(r.selling_price_base),
        wholesale_price_base: r.wholesale_price_base ? Number(r.wholesale_price_base) : null,
        profit_base: Number(r.profit_base),
        items: (r.items || []).map((it: any) => ({
          ...it,
          pack_qty_snapshot: Number(it.pack_qty_snapshot),
          pack_price_snapshot: Number(it.pack_price_snapshot),
          unit_cost_snapshot: Number(it.unit_cost_snapshot),
          qty_to_use: Number(it.qty_to_use),
          cost_used_base: Number(it.cost_used_base),
        })),
      })) as CraftRecipe[];
    } catch (err) {
      console.error("[CraftWorkshopRepository] getRecipes exception:", err);
      return [];
    }
  }

  /**
   * Obtiene una receta por ID con sus renglones
   */
  static async getRecipeById(
    tenantId: string,
    recipeId: string
  ): Promise<CraftRecipe | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from("craft_recipes")
        .select("*, items:craft_recipe_items(*)")
        .eq("tenant_id", tenantId)
        .eq("id", recipeId)
        .maybeSingle();

      if (error || !data) return null;

      return {
        ...data,
        materials_cost_base: Number(data.materials_cost_base),
        waste_percentage: Number(data.waste_percentage),
        labor_cost_base: Number(data.labor_cost_base),
        direct_cost_base: Number(data.direct_cost_base),
        margin_percentage: Number(data.margin_percentage),
        selling_price_base: Number(data.selling_price_base),
        wholesale_price_base: data.wholesale_price_base ? Number(data.wholesale_price_base) : null,
        profit_base: Number(data.profit_base),
        items: (data.items || []).map((it: any) => ({
          ...it,
          pack_qty_snapshot: Number(it.pack_qty_snapshot),
          pack_price_snapshot: Number(it.pack_price_snapshot),
          unit_cost_snapshot: Number(it.unit_cost_snapshot),
          qty_to_use: Number(it.qty_to_use),
          cost_used_base: Number(it.cost_used_base),
        })),
      } as CraftRecipe;
    } catch {
      return null;
    }
  }

  /**
   * Crea una nueva receta técnica con sus renglones de insumos
   */
  static async createRecipe(input: CreateCraftRecipeInput): Promise<CraftRecipe | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      const recipeId = generateUuid();
      const wastePct = input.wastePercentage !== undefined ? input.wastePercentage : 5.0;
      const laborCost = input.laborCostBase !== undefined ? input.laborCostBase : 0;
      const marginPct = input.marginPercentage !== undefined ? input.marginPercentage : 30.0;
      const formula = input.pricingFormula || "MARGIN";

      // 1. Calcular suma de materiales activos
      let matCostSum = 0;
      const itemsPayload = input.items.map((it, idx) => {
        const unitCost =
          it.unitCostSnapshot !== undefined && it.unitCostSnapshot > 0
            ? it.unitCostSnapshot
            : it.packQtySnapshot > 0
            ? it.packPriceSnapshot / it.packQtySnapshot
            : 0;
        const costUsed = unitCost * it.qtyToUse;
        if (it.isChecked) {
          matCostSum += costUsed;
        }

        return {
          id: generateUuid(),
          tenant_id: input.tenantId,
          recipe_id: recipeId,
          material_id: it.materialId || null,
          custom_name: it.customName.trim(),
          pack_qty_snapshot: it.packQtySnapshot,
          pack_price_snapshot: it.packPriceSnapshot,
          unit_cost_snapshot: Math.round(unitCost * 10000) / 10000,
          qty_to_use: it.qtyToUse,
          is_checked: it.isChecked,
          sort_order: it.sortOrder !== undefined ? it.sortOrder : idx,
        };
      });

      const directCost = Math.round((matCostSum * (1 + wastePct / 100.0) + laborCost) * 100) / 100;
      let calculatedSellingPrice = directCost;

      if (input.sellingPriceBase !== undefined && input.sellingPriceBase > 0) {
        calculatedSellingPrice = input.sellingPriceBase;
      } else if (formula === "MARGIN" && marginPct < 100) {
        calculatedSellingPrice = Math.round((directCost / (1.0 - marginPct / 100.0)) * 100) / 100;
      } else {
        calculatedSellingPrice = Math.round((directCost * (1.0 + marginPct / 100.0)) * 100) / 100;
      }

      // 2. Insertar cabecera de receta
      const recipePayload = {
        id: recipeId,
        tenant_id: input.tenantId,
        name: input.name.trim(),
        sku: input.sku?.trim() || null,
        technique: input.technique,
        category_name: input.categoryName?.trim() || "General",
        materials_cost_base: Math.round(matCostSum * 100) / 100,
        waste_percentage: wastePct,
        labor_cost_base: laborCost,
        pricing_formula: formula,
        margin_percentage: marginPct,
        selling_price_base: calculatedSellingPrice,
        wholesale_price_base: input.wholesalePriceBase || null,
        has_pending_recalc: false,
        is_published: Boolean(input.isPublished),
        product_id: input.productId || null,
        notes: input.notes?.trim() || null,
        is_active: true,
      };

      const { data: createdRecipe, error: recipeErr } = await supabase
        .from("craft_recipes")
        .insert(recipePayload)
        .select()
        .single();

      if (recipeErr || !createdRecipe) {
        console.error("[CraftWorkshopRepository] Error creating recipe:", recipeErr?.message);
        return null;
      }

      // 3. Insertar renglones relacionales
      if (itemsPayload.length > 0) {
        const { error: itemsErr } = await supabase
          .from("craft_recipe_items")
          .insert(itemsPayload);

        if (itemsErr) {
          console.error("[CraftWorkshopRepository] Error creating recipe items:", itemsErr.message);
        }
      }

      return await this.getRecipeById(input.tenantId, recipeId);
    } catch (err) {
      console.error("[CraftWorkshopRepository] createRecipe exception:", err);
      return null;
    }
  }

  /**
   * Actualiza una receta y sincroniza sus renglones relacionales
   */
  static async updateRecipe(input: UpdateCraftRecipeInput): Promise<CraftRecipe | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      // 1. Si se enviaron items, regenerar o actualizar renglones
      if (input.items) {
        await supabase
          .from("craft_recipe_items")
          .delete()
          .eq("tenant_id", input.tenantId)
          .eq("recipe_id", input.recipeId);

        let matCostSum = 0;
        const itemsPayload = input.items.map((it, idx) => {
          const unitCost =
            it.unitCostSnapshot !== undefined && it.unitCostSnapshot > 0
              ? it.unitCostSnapshot
              : it.packQtySnapshot > 0
              ? it.packPriceSnapshot / it.packQtySnapshot
              : 0;
          const costUsed = unitCost * it.qtyToUse;
          if (it.isChecked) {
            matCostSum += costUsed;
          }

          return {
            id: generateUuid(),
            tenant_id: input.tenantId,
            recipe_id: input.recipeId,
            material_id: it.materialId || null,
            custom_name: it.customName.trim(),
            pack_qty_snapshot: it.packQtySnapshot,
            pack_price_snapshot: it.packPriceSnapshot,
            unit_cost_snapshot: Math.round(unitCost * 10000) / 10000,
            qty_to_use: it.qtyToUse,
            is_checked: it.isChecked,
            sort_order: it.sortOrder !== undefined ? it.sortOrder : idx,
          };
        });

        if (itemsPayload.length > 0) {
          await supabase.from("craft_recipe_items").insert(itemsPayload);
        }
      }

      // 2. Ejecutar recálculo rápido
      await supabase.rpc("rpc_recalculate_craft_recipes", {
        p_tenant_id: input.tenantId,
        p_sync_storefront: Boolean(input.isPublished),
      });

      // 3. Aplicar actualizaciones manuales adicionales
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (input.name !== undefined) updates.name = input.name.trim();
      if (input.sku !== undefined) updates.sku = input.sku?.trim() || null;
      if (input.technique !== undefined) updates.technique = input.technique;
      if (input.categoryName !== undefined) updates.category_name = input.categoryName?.trim() || "General";
      if (input.wastePercentage !== undefined) updates.waste_percentage = input.wastePercentage;
      if (input.laborCostBase !== undefined) updates.labor_cost_base = input.laborCostBase;
      if (input.pricingFormula !== undefined) updates.pricing_formula = input.pricingFormula;
      if (input.marginPercentage !== undefined) updates.margin_percentage = input.marginPercentage;
      if (input.sellingPriceBase !== undefined) updates.selling_price_base = input.sellingPriceBase;
      if (input.wholesalePriceBase !== undefined) updates.wholesale_price_base = input.wholesalePriceBase;
      if (input.notes !== undefined) updates.notes = input.notes?.trim() || null;
      if (input.isPublished !== undefined) updates.is_published = input.isPublished;
      if (input.productId !== undefined) updates.product_id = input.productId || null;
      if (input.isActive !== undefined) updates.is_active = input.isActive;

      await supabase
        .from("craft_recipes")
        .update(updates)
        .eq("tenant_id", input.tenantId)
        .eq("id", input.recipeId);

      return await this.getRecipeById(input.tenantId, input.recipeId);
    } catch (err) {
      console.error("[CraftWorkshopRepository] updateRecipe exception:", err);
      return null;
    }
  }

  /**
   * Eliminación lógica de una receta
   */
  static async deleteRecipe(tenantId: string, recipeId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;

    try {
      const { error } = await supabase
        .from("craft_recipes")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("id", recipeId);

      return !error;
    } catch {
      return false;
    }
  }

  // =========================================================================
  // 3. RECÁLCULO ATÓMICO EN PL/PGSQL (rpc_recalculate_craft_recipes)
  // =========================================================================

  /**
   * Invoca el Stored Procedure atómico para actualizar todas las recetas del tenant (< 5ms)
   */
  static async recalculateRecipes(
    tenantId: string,
    syncStorefront = false
  ): Promise<RecalculateCraftRecipesResult> {
    const supabase = getSupabase();
    if (!supabase) return { updated_recipes: 0, synced_products: 0 };

    try {
      const { data, error } = await supabase.rpc("rpc_recalculate_craft_recipes", {
        p_tenant_id: tenantId,
        p_sync_storefront: syncStorefront,
      });

      if (error) {
        console.error("[CraftWorkshopRepository] rpc_recalculate_craft_recipes error:", error.message);
        return { updated_recipes: 0, synced_products: 0 };
      }

      return (data || { updated_recipes: 0, synced_products: 0 }) as RecalculateCraftRecipesResult;
    } catch (err) {
      console.error("[CraftWorkshopRepository] recalculateRecipes exception:", err);
      return { updated_recipes: 0, synced_products: 0 };
    }
  }

  // =========================================================================
  // 4. COTIZACIONES RÁPIDAS PARA WHATSAPP (craft_quotes)
  // =========================================================================

  /**
   * Obtiene las cotizaciones de un comercio
   */
  static async getQuotes(tenantId: string, limit = 50): Promise<CraftQuote[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from("craft_quotes")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.warn("[CraftWorkshopRepository] Error fetching quotes:", error.message);
        return [];
      }

      return (data || []).map((q) => ({
        ...q,
        shipping_cost_base: Number(q.shipping_cost_base),
        subtotal_base: Number(q.subtotal_base),
        total_base: Number(q.total_base),
        exchange_rate_applied: Number(q.exchange_rate_applied),
        total_secondary: Number(q.total_secondary),
        deposit_percentage: Number(q.deposit_percentage),
        deposit_required_base: Number(q.deposit_required_base),
      })) as CraftQuote[];
    } catch {
      return [];
    }
  }

  /**
   * Genera un nuevo correlativo de cotización atómico
   */
  static async generateQuoteNumber(tenantId: string): Promise<string> {
    const supabase = getSupabase();
    if (!supabase) return `COT-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      const { count } = await supabase
        .from("craft_quotes")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);

      const nextNum = (count || 0) + 1;
      return `COT-${String(nextNum).padStart(5, "0")}`;
    } catch {
      return `COT-${Date.now().toString().slice(-5)}`;
    }
  }

  /**
   * Crea una nueva cotización
   */
  static async createQuote(input: CreateCraftQuoteInput): Promise<CraftQuote | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      const quoteNum = input.quoteNumber || (await this.generateQuoteNumber(input.tenantId));
      const shippingCost = input.shippingCostBase || 0;
      const rate = input.exchangeRateApplied && input.exchangeRateApplied > 0 ? input.exchangeRateApplied : 1;
      const depositPct = input.depositPercentage !== undefined ? input.depositPercentage : 50.0;

      let subtotal = 0;
      const items = (input.items || []).map((it) => {
        const itemSubtotal = it.unit_price_base * it.quantity;
        subtotal += itemSubtotal;
        return {
          ...it,
          subtotal_base: Math.round(itemSubtotal * 100) / 100,
        };
      });

      const totalBase = Math.round((subtotal + shippingCost) * 100) / 100;
      const totalSec = Math.round(totalBase * rate * 100) / 100;

      const payload = {
        id: generateUuid(),
        tenant_id: input.tenantId,
        quote_number: quoteNum,
        customer_name: input.customerName?.trim() || null,
        customer_phone: input.customerPhone?.trim() || null,
        items,
        shipping_notes: input.shippingNotes?.trim() || null,
        shipping_cost_base: shippingCost,
        subtotal_base: Math.round(subtotal * 100) / 100,
        total_base: totalBase,
        base_currency: input.baseCurrency || "USD",
        exchange_rate_applied: rate,
        total_secondary: totalSec,
        deposit_percentage: depositPct,
        status: "draft" as CraftQuoteStatus,
      };

      const { data, error } = await supabase
        .from("craft_quotes")
        .insert(payload)
        .select()
        .single();

      if (error || !data) {
        console.error("[CraftWorkshopRepository] Error creating quote:", error?.message);
        return null;
      }

      return {
        ...data,
        shipping_cost_base: Number(data.shipping_cost_base),
        subtotal_base: Number(data.subtotal_base),
        total_base: Number(data.total_base),
        exchange_rate_applied: Number(data.exchange_rate_applied),
        total_secondary: Number(data.total_secondary),
        deposit_percentage: Number(data.deposit_percentage),
        deposit_required_base: Number(data.deposit_required_base),
      } as CraftQuote;
    } catch (err) {
      console.error("[CraftWorkshopRepository] createQuote exception:", err);
      return null;
    }
  }

  /**
   * Actualiza el estado de una cotización y su orden convertida
   */
  static async updateQuoteStatus(
    tenantId: string,
    quoteId: string,
    status: CraftQuoteStatus,
    convertedOrderId?: string
  ): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;

    try {
      const updates: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (convertedOrderId) {
        updates.converted_order_id = convertedOrderId;
      }

      const { error } = await supabase
        .from("craft_quotes")
        .update(updates)
        .eq("tenant_id", tenantId)
        .eq("id", quoteId);

      return !error;
    } catch {
      return false;
    }
  }
}
