import type {
  PrintopinkCalculation,
  CreatePrintopinkCalculationInput,
  UpdatePrintopinkCalculationInput,
  PrintopinkQuote,
  CreatePrintopinkQuoteInput,
  PrintopinkQuoteStatus,
} from "@marketos/types";
import { getSupabase, generateUuid } from "./base.ts";

export class PrintopinkCalculatorRepository {
  // =========================================================================
  // 1. FICHAS DE COSTEO RÁPIDO (printopink_calculations)
  // =========================================================================

  /**
   * Obtiene todos los cálculos guardados de un tenant ordenados por fecha descendente
   */
  static async listCalculations(tenantId: string): Promise<PrintopinkCalculation[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from("printopink_calculations")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("[PrintopinkCalculatorRepository] Error listCalculations:", error.message);
        return [];
      }

      return (data || []).map((c) => ({
        ...c,
        materials_cost_base: Number(c.materials_cost_base),
        machinery_cost_base: Number(c.machinery_cost_base),
        labor_cost_base: Number(c.labor_cost_base),
        waste_percentage: Number(c.waste_percentage),
        total_cost_base: Number(c.total_cost_base),
        selling_price_base: Number(c.selling_price_base),
        wholesale_price_base: c.wholesale_price_base ? Number(c.wholesale_price_base) : null,
        net_profit_base: Number(c.net_profit_base),
        margin_percentage: Number(c.margin_percentage),
        materials_breakdown: Array.isArray(c.materials_breakdown) ? c.materials_breakdown : [],
      })) as PrintopinkCalculation[];
    } catch (err) {
      console.error("[PrintopinkCalculatorRepository] Exception in listCalculations:", err);
      return [];
    }
  }

  /**
   * Obtiene un cálculo específico por ID
   */
  static async getCalculationById(
    tenantId: string,
    id: string
  ): Promise<PrintopinkCalculation | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from("printopink_calculations")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("id", id)
        .maybeSingle();

      if (error || !data) return null;

      return {
        ...data,
        materials_cost_base: Number(data.materials_cost_base),
        machinery_cost_base: Number(data.machinery_cost_base),
        labor_cost_base: Number(data.labor_cost_base),
        waste_percentage: Number(data.waste_percentage),
        total_cost_base: Number(data.total_cost_base),
        selling_price_base: Number(data.selling_price_base),
        wholesale_price_base: data.wholesale_price_base ? Number(data.wholesale_price_base) : null,
        net_profit_base: Number(data.net_profit_base),
        margin_percentage: Number(data.margin_percentage),
        materials_breakdown: Array.isArray(data.materials_breakdown) ? data.materials_breakdown : [],
      } as PrintopinkCalculation;
    } catch (err) {
      console.error("[PrintopinkCalculatorRepository] Exception in getCalculationById:", err);
      return null;
    }
  }

  /**
   * Guarda una nueva ficha de costeo
   */
  static async saveCalculation(
    input: CreatePrintopinkCalculationInput
  ): Promise<PrintopinkCalculation> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Base de datos no disponible");

    const wasteMultiplier = 1 + (input.wastePercentage || 0) / 100;
    const materialsCostWithWaste = input.materialsCostBase * wasteMultiplier;
    const totalCost = materialsCostWithWaste + input.machineryCostBase + input.laborCostBase;
    const netProfit = input.sellingPriceBase - totalCost;
    const marginPercentage =
      input.sellingPriceBase > 0 ? (netProfit / input.sellingPriceBase) * 100 : 0;

    const record = {
      tenant_id: input.tenantId,
      title: input.title.trim(),
      preset_category: input.presetCategory || "custom",
      materials_cost_base: Math.round(input.materialsCostBase * 10000) / 10000,
      machinery_cost_base: Math.round(input.machineryCostBase * 10000) / 10000,
      labor_cost_base: Math.round(input.laborCostBase * 10000) / 10000,
      waste_percentage: Math.round((input.wastePercentage || 0) * 100) / 100,
      total_cost_base: Math.round(totalCost * 100) / 100,
      selling_price_base: Math.round(input.sellingPriceBase * 100) / 100,
      wholesale_price_base: input.wholesalePriceBase
        ? Math.round(input.wholesalePriceBase * 100) / 100
        : null,
      net_profit_base: Math.round(netProfit * 100) / 100,
      margin_percentage: Math.round(marginPercentage * 10) / 10,
      materials_breakdown: input.materialsBreakdown,
      notes: input.notes?.trim() || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("printopink_calculations")
      .insert(record)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Error al guardar cálculo: ${error?.message || "Desconocido"}`);
    }

    return {
      ...data,
      materials_cost_base: Number(data.materials_cost_base),
      machinery_cost_base: Number(data.machinery_cost_base),
      labor_cost_base: Number(data.labor_cost_base),
      waste_percentage: Number(data.waste_percentage),
      total_cost_base: Number(data.total_cost_base),
      selling_price_base: Number(data.selling_price_base),
      wholesale_price_base: data.wholesale_price_base ? Number(data.wholesale_price_base) : null,
      net_profit_base: Number(data.net_profit_base),
      margin_percentage: Number(data.margin_percentage),
      materials_breakdown: Array.isArray(data.materials_breakdown) ? data.materials_breakdown : [],
    } as PrintopinkCalculation;
  }

  /**
   * Actualiza una ficha existente
   */
  static async updateCalculation(
    input: UpdatePrintopinkCalculationInput
  ): Promise<PrintopinkCalculation> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Base de datos no disponible");

    const current = await this.getCalculationById(input.tenantId, input.id);
    if (!current) throw new Error("Cálculo no encontrado");

    const materialsCost = input.materialsCostBase ?? current.materials_cost_base;
    const machineryCost = input.machineryCostBase ?? current.machinery_cost_base;
    const laborCost = input.laborCostBase ?? current.labor_cost_base;
    const wastePct = input.wastePercentage ?? current.waste_percentage;
    const sellingPrice = input.sellingPriceBase ?? current.selling_price_base;

    const wasteMultiplier = 1 + wastePct / 100;
    const totalCost = materialsCost * wasteMultiplier + machineryCost + laborCost;
    const netProfit = sellingPrice - totalCost;
    const marginPercentage = sellingPrice > 0 ? (netProfit / sellingPrice) * 100 : 0;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      total_cost_base: Math.round(totalCost * 100) / 100,
      net_profit_base: Math.round(netProfit * 100) / 100,
      margin_percentage: Math.round(marginPercentage * 10) / 10,
    };

    if (input.title !== undefined) updates.title = input.title.trim();
    if (input.presetCategory !== undefined) updates.preset_category = input.presetCategory;
    if (input.materialsCostBase !== undefined) updates.materials_cost_base = materialsCost;
    if (input.machineryCostBase !== undefined) updates.machinery_cost_base = machineryCost;
    if (input.laborCostBase !== undefined) updates.labor_cost_base = laborCost;
    if (input.wastePercentage !== undefined) updates.waste_percentage = wastePct;
    if (input.sellingPriceBase !== undefined) updates.selling_price_base = sellingPrice;
    if (input.wholesalePriceBase !== undefined)
      updates.wholesale_price_base = input.wholesalePriceBase;
    if (input.materialsBreakdown !== undefined)
      updates.materials_breakdown = input.materialsBreakdown;
    if (input.notes !== undefined) updates.notes = input.notes?.trim() || null;
    if (input.isActive !== undefined) updates.is_active = input.isActive;

    const { data, error } = await supabase
      .from("printopink_calculations")
      .update(updates)
      .eq("tenant_id", input.tenantId)
      .eq("id", input.id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Error al actualizar cálculo: ${error?.message || "Desconocido"}`);
    }

    return {
      ...data,
      materials_cost_base: Number(data.materials_cost_base),
      machinery_cost_base: Number(data.machinery_cost_base),
      labor_cost_base: Number(data.labor_cost_base),
      waste_percentage: Number(data.waste_percentage),
      total_cost_base: Number(data.total_cost_base),
      selling_price_base: Number(data.selling_price_base),
      wholesale_price_base: data.wholesale_price_base ? Number(data.wholesale_price_base) : null,
      net_profit_base: Number(data.net_profit_base),
      margin_percentage: Number(data.margin_percentage),
      materials_breakdown: Array.isArray(data.materials_breakdown) ? data.materials_breakdown : [],
    } as PrintopinkCalculation;
  }

  /**
   * Elimina un cálculo (soft delete)
   */
  static async deleteCalculation(tenantId: string, id: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;

    const { error } = await supabase
      .from("printopink_calculations")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("id", id);

    return !error;
  }

  // =========================================================================
  // 2. COTIZACIONES RÁPIDAS (printopink_quotes)
  // =========================================================================

  /**
   * Obtiene la lista de cotizaciones de un tenant
   */
  static async listQuotes(tenantId: string): Promise<PrintopinkQuote[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from("printopink_quotes")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("[PrintopinkCalculatorRepository] Error listQuotes:", error.message);
        return [];
      }

      return (data || []).map((q) => ({
        ...q,
        total_base: Number(q.total_base),
        deposit_required_base: Number(q.deposit_required_base),
        pending_balance_base: Number(q.pending_balance_base),
        items: Array.isArray(q.items) ? q.items : [],
      })) as PrintopinkQuote[];
    } catch (err) {
      console.error("[PrintopinkCalculatorRepository] Exception in listQuotes:", err);
      return [];
    }
  }

  /**
   * Crea una nueva cotización con cálculo del 50% de anticipo
   */
  static async createQuote(input: CreatePrintopinkQuoteInput): Promise<PrintopinkQuote> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Base de datos no disponible");

    let total = 0;
    const processedItems = input.items.map((it) => {
      const subtotal = Math.round(it.unitPriceBase * it.quantity * 100) / 100;
      total += subtotal;
      return {
        id: generateUuid(),
        calculationId: it.calculationId || null,
        title: it.title.trim(),
        unitPriceBase: it.unitPriceBase,
        quantity: it.quantity,
        subtotalBase: subtotal,
        notes: it.notes || undefined,
      };
    });

    const depositPct = input.depositPercentage !== undefined ? input.depositPercentage : 50;
    const safeDepositRate = Math.min(Math.max(0, depositPct), 100) / 100;
    const depositRequired = Math.round(total * safeDepositRate * 100) / 100;
    const pendingBalance = Math.round((total - depositRequired) * 100) / 100;

    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const quoteNumber = `PP-${new Date().getFullYear().toString().slice(-2)}${String(
      new Date().getMonth() + 1
    ).padStart(2, "0")}-${randomDigits}`;

    const record = {
      tenant_id: input.tenantId,
      quote_number: quoteNumber,
      customer_name: input.customerName?.trim() || null,
      customer_phone: input.customerPhone?.trim() || null,
      total_base: total,
      deposit_required_base: depositRequired,
      pending_balance_base: pendingBalance,
      items: processedItems,
      notes: input.notes?.trim() || null,
      status: "draft",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("printopink_quotes")
      .insert(record)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Error al crear cotización: ${error?.message || "Desconocido"}`);
    }

    return {
      ...data,
      total_base: Number(data.total_base),
      deposit_required_base: Number(data.deposit_required_base),
      pending_balance_base: Number(data.pending_balance_base),
      items: Array.isArray(data.items) ? data.items : [],
    } as PrintopinkQuote;
  }

  /**
   * Actualiza el estado de una cotización
   */
  static async updateQuoteStatus(
    tenantId: string,
    quoteId: string,
    status: PrintopinkQuoteStatus
  ): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;

    const { error } = await supabase
      .from("printopink_quotes")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("id", quoteId);

    return !error;
  }
}
