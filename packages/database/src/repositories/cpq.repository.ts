import type {
  CpqCostSettings,
  CpqPricingMatrix,
  CpqAttributeOption,
  CpqQuote,
  CpqQuoteItem,
  CpqOrderMilestone,
  Order,
} from "@marketos/types";
import { state } from "../mock-data.ts";
import { getSupabase, generateUuid, isLiveDatabaseConfigured } from "./base.ts";
import { AuditRepository } from "./audit.repository.ts";
import { TenantRepository } from "./tenant.repository.ts";
import { OrderRepository } from "./order.repository.ts";

export class CpqRepository {

static async getTenantCpqSettings(tenantId: string): Promise<CpqCostSettings | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from("cpq_cost_settings")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return (data as CpqCostSettings) || null;
    } catch (e) {
      console.warn("[MarketOS] getTenantCpqSettings error:", e);
      return null;
    }
  }

static async saveTenantCpqSettings(
    tenantId: string,
    settings: Partial<CpqCostSettings>
  ): Promise<CpqCostSettings | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    try {
      const payload = {
        tenant_id: tenantId,
        hourly_labor_rate: settings.hourly_labor_rate ?? 15,
        machine_cost_per_hour: settings.machine_cost_per_hour ?? 10,
        default_margin_percentage: settings.default_margin_percentage ?? 35,
        default_deposit_percentage: settings.default_deposit_percentage ?? 50,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from("cpq_cost_settings")
        .upsert(payload, { onConflict: "tenant_id" })
        .select()
        .single();
      if (error) throw error;
      return (data as CpqCostSettings) || null;
    } catch (e) {
      console.warn("[MarketOS] saveTenantCpqSettings error:", e);
      return null;
    }
  }

static async getCpqPricingMatrices(
    tenantId: string,
    productId?: string
  ): Promise<CpqPricingMatrix[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    try {
      let query = supabase
        .from("cpq_pricing_matrices")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true });
      if (productId) {
        query = query.eq("product_id", productId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data as CpqPricingMatrix[]) || [];
    } catch (e) {
      console.warn("[MarketOS] getCpqPricingMatrices error:", e);
      return [];
    }
  }

static async saveCpqPricingMatrix(
    matrix: Partial<CpqPricingMatrix> & { tenant_id: string; name: string }
  ): Promise<CpqPricingMatrix | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    try {
      if (matrix.id) {
        const { data, error } = await supabase
          .from("cpq_pricing_matrices")
          .update({
            ...matrix,
            updated_at: new Date().toISOString(),
          })
          .eq("id", matrix.id)
          .eq("tenant_id", matrix.tenant_id)
          .select()
          .single();
        if (error) throw error;
        return data as CpqPricingMatrix;
      } else {
        const { data, error } = await supabase
          .from("cpq_pricing_matrices")
          .insert(matrix)
          .select()
          .single();
        if (error) throw error;
        return data as CpqPricingMatrix;
      }
    } catch (e) {
      console.warn("[MarketOS] saveCpqPricingMatrix error:", e);
      return null;
    }
  }

static async getCpqMatrixAttributeOptions(
    matrixId: string
  ): Promise<CpqAttributeOption[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from("cpq_attribute_options")
        .select("*")
        .eq("pricing_matrix_id", matrixId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as CpqAttributeOption[]) || [];
    } catch (e) {
      console.warn("[MarketOS] getCpqMatrixAttributeOptions error:", e);
      return [];
    }
  }

static async createCpqQuote(input: {
    quote: Partial<CpqQuote> & { tenant_id: string; total_price: number };
    items: Omit<CpqQuoteItem, "id" | "quote_id">[];
  }): Promise<CpqQuote | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    try {
      const quoteNumber =
        input.quote.quote_number || `COT-${Date.now().toString().slice(-6)}`;
      const depositPercentage = input.quote.deposit_percentage ?? 50;
      const depositAmount =
        input.quote.deposit_amount ??
        (input.quote.total_price * depositPercentage) / 100;

      const { data: quote, error: quoteErr } = await supabase
        .from("cpq_quotes")
        .insert({
          ...input.quote,
          quote_number: quoteNumber,
          deposit_percentage: depositPercentage,
          deposit_amount: depositAmount,
          status: input.quote.status || "DRAFT",
        })
        .select()
        .single();

      if (quoteErr || !quote) throw quoteErr || new Error("Failed to insert quote");

      if (input.items && input.items.length > 0) {
        const itemsPayload = input.items.map((item) => ({
          ...item,
          quote_id: quote.id,
        }));
        const { error: itemsErr } = await supabase
          .from("cpq_quote_items")
          .insert(itemsPayload);
        if (itemsErr) {
          console.warn("[MarketOS] createCpqQuote items insert error:", itemsErr);
        }
      }

      return quote as CpqQuote;
    } catch (e) {
      console.warn("[MarketOS] createCpqQuote error:", e);
      return null;
    }
  }

static async getCpqQuotes(tenantId: string): Promise<CpqQuote[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from("cpq_quotes")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as CpqQuote[]) || [];
    } catch (e) {
      console.warn("[MarketOS] getCpqQuotes error:", e);
      return [];
    }
  }

static async convertQuoteToOrder(
    quoteId: string,
    storeId: string
  ): Promise<{ order: Order; milestone: CpqOrderMilestone } | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    try {
      const { data: quote, error: qErr } = await supabase
        .from("cpq_quotes")
        .select("*, cpq_quote_items(*)")
        .eq("id", quoteId)
        .single();

      if (qErr || !quote) throw qErr || new Error("Quote not found");

      const depositPct = quote.deposit_percentage ?? 50;
      const depositAmt =
        quote.deposit_amount ?? (quote.total_price * depositPct) / 100;

      // 1. Create order
      const orderNumber = `ORD-MTO-${Date.now().toString().slice(-6)}`;
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          tenant_id: quote.tenant_id,
          store_id: storeId,
          order_number: orderNumber,
          customer_name: quote.customer_name || "Cliente Taller",
          customer_phone: quote.customer_phone || "",
          delivery_type: "pickup",
          total_amount_usd: quote.total_price,
          status: "PENDING",
          payment_status: "PENDING",
          notes: `Orden generada desde Presupuesto #${quote.quote_number}`,
        })
        .select()
        .single();

      if (orderErr || !order) throw orderErr || new Error("Failed to create order from quote");

      // 2. Create order items if any
      const quoteItems = quote.cpq_quote_items || [];
      if (quoteItems.length > 0) {
        const orderItemsPayload = quoteItems.map((qi: any) => ({
          order_id: order.id,
          product_id: qi.product_id,
          product_name: qi.product_name,
          quantity: qi.quantity,
          unit_price_usd: qi.unit_price,
          total_price_usd: qi.total_price,
        }));
        await supabase.from("order_items").insert(orderItemsPayload);
      }

      // 3. Create CPQ Order Milestone
      const { data: milestone, error: mileErr } = await supabase
        .from("cpq_order_milestones")
        .insert({
          order_id: order.id,
          tenant_id: quote.tenant_id,
          total_amount: quote.total_price,
          paid_amount: 0,
          pending_balance: quote.total_price,
          required_deposit_percentage: depositPct,
          required_deposit_amount: depositAmt,
          allow_dispatch_with_balance: false,
        })
        .select()
        .single();

      if (mileErr) console.warn("[MarketOS] milestone insert error:", mileErr);

      // 4. Update quote status to ACCEPTED
      await supabase
        .from("cpq_quotes")
        .update({ status: "ACCEPTED", updated_at: new Date().toISOString() })
        .eq("id", quoteId);

      return {
        order: order as Order,
        milestone: milestone as CpqOrderMilestone,
      };
    } catch (e) {
      console.warn("[MarketOS] convertQuoteToOrder error:", e);
      return null;
    }
  }

static async getCpqOrderMilestone(orderId: string): Promise<CpqOrderMilestone | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from("cpq_order_milestones")
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle();
      if (error) throw error;
      return (data as CpqOrderMilestone) || null;
    } catch (e) {
      console.warn("[MarketOS] getCpqOrderMilestone error:", e);
      return null;
    }
  }

static async recordCpqMilestonePayment(
    milestoneId: string,
    amount: number,
    note?: string
  ): Promise<CpqOrderMilestone | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    try {
      const { data: current, error: curErr } = await supabase
        .from("cpq_order_milestones")
        .select("*")
        .eq("id", milestoneId)
        .single();
      if (curErr || !current) throw curErr || new Error("Milestone not found");

      const newPaid = Number(current.paid_amount || 0) + amount;
      const newPending = Math.max(0, Number(current.total_amount || 0) - newPaid);

      const { data: updated, error: upErr } = await supabase
        .from("cpq_order_milestones")
        .update({
          paid_amount: newPaid,
          pending_balance: newPending,
          updated_at: new Date().toISOString(),
        })
        .eq("id", milestoneId)
        .select()
        .single();

      if (upErr) throw upErr;
      return updated as CpqOrderMilestone;
    } catch (e) {
      console.warn("[MarketOS] recordCpqMilestonePayment error:", e);
      return null;
    }
  }

static async updateCpqMilestoneDispatchAllowance(
    milestoneId: string,
    allow: boolean
  ): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;
    try {
      const { error } = await supabase
        .from("cpq_order_milestones")
        .update({
          allow_dispatch_with_balance: allow,
          updated_at: new Date().toISOString(),
        })
        .eq("id", milestoneId);
      return !error;
    } catch (e) {
      console.warn("[MarketOS] updateCpqMilestoneDispatchAllowance error:", e);
      return false;
    }
  }
}
