import { getSupabase, isLiveDatabaseConfigured } from "./base.ts";
import type { PosShift } from "@marketos/types";

export interface OpenShiftInput {
  tenantId: string;
  storeId: string;
  cashierId: string;
  cashierName?: string;
  openingCashPrimary: number;
  openingCashSecondary: number;
  notes?: string;
}

export interface CloseShiftInput {
  shiftId: string;
  tenantId: string;
  closingCashPrimary: number;
  closingCashSecondary: number;
  notes?: string;
}

export class PosRepository {
  /**
   * Opens a new POS Cash Shift
   */
  static async openShift(input: OpenShiftInput): Promise<PosShift | null> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("pos_shifts")
          .insert({
            tenant_id: input.tenantId,
            store_id: input.storeId,
            cashier_id: input.cashierId,
            cashier_name: input.cashierName || "Cajero",
            status: "OPEN",
            opened_at: new Date().toISOString(),
            opening_cash_primary: input.openingCashPrimary,
            opening_cash_secondary: input.openingCashSecondary,
            notes: input.notes,
          })
          .select()
          .single();

        if (!error && data) {
          return data as PosShift;
        }
        if (error) {
          console.warn("[MarketOS POS] Error opening shift:", error);
        }
      } catch (err) {
        console.warn("[MarketOS POS] openShift error:", err);
      }
    }
    return null;
  }

  /**
   * Get active/open POS shift for a store/cashier
   */
  static async getActiveShift(
    tenantId: string,
    storeId: string,
    cashierId?: string
  ): Promise<PosShift | null> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        let query = supabase
          .from("pos_shifts")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("store_id", storeId)
          .eq("status", "OPEN")
          .order("opened_at", { ascending: false })
          .limit(1);

        if (cashierId) {
          query = query.eq("cashier_id", cashierId);
        }

        const { data, error } = await query.maybeSingle();
        if (!error && data) {
          return data as PosShift;
        }
      } catch (err) {
        console.warn("[MarketOS POS] getActiveShift error:", err);
      }
    }
    return null;
  }

  /**
   * Atomic closure of POS shift via PostgreSQL RPC with blind balance reconciliation
   */
  static async closeShiftAtomic(
    input: CloseShiftInput
  ): Promise<{ success: boolean; shift?: PosShift; error?: string }> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc("rpc_close_pos_shift", {
          p_payload: {
            shift_id: input.shiftId,
            tenant_id: input.tenantId,
            closing_cash_primary: input.closingCashPrimary,
            closing_cash_secondary: input.closingCashSecondary,
            notes: input.notes,
          },
        });

        if (!error && data && data.success) {
          return data;
        }
        if (error) {
          console.warn("[MarketOS POS] rpc_close_pos_shift error:", error);
          return { success: false, error: error.message };
        }
      } catch (err: any) {
        console.warn("[MarketOS POS] rpc_close_pos_shift exception:", err);
        return { success: false, error: err?.message || "Error al cerrar turno POS" };
      }
    }
    return { success: false, error: "Servicio de base de datos no disponible" };
  }

  /**
   * Retrieve shift history for a store
   */
  static async getShiftHistory(
    tenantId: string,
    storeId?: string,
    limit = 30
  ): Promise<PosShift[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        let query = supabase
          .from("pos_shifts")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("opened_at", { ascending: false })
          .limit(limit);

        if (storeId) {
          query = query.eq("store_id", storeId);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          return data as unknown as PosShift[];
        }
      } catch (err) {
        console.warn("[MarketOS POS] getShiftHistory error:", err);
      }
    }
    return [];
  }
}
