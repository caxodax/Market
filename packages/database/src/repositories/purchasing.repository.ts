import type {
  PurchaseInvoice,
  RetentionVoucher,
  Supplier,
} from "@marketos/types";
import { state } from "../mock-data.ts";
import { getSupabase } from "./base.ts";
import { AuditRepository } from "./audit.repository.ts";

export class PurchasingRepository {
  /**
   * List all purchase invoices for a tenant
   */
  static async getPurchaseInvoices(tenantId: string): Promise<PurchaseInvoice[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("purchase_invoices")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("invoice_date", { ascending: false });

        if (!error && Array.isArray(data)) {
          return data as PurchaseInvoice[];
        }
      } catch (err) {
        console.warn("[MarketOS Purchasing] Supabase query error, fallback to memory:", err);
      }
    }

    return state.purchaseInvoices
      .filter((inv) => inv.tenant_id === tenantId)
      .sort((a, b) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime());
  }

  /**
   * Get single purchase invoice by ID
   */
  static async getPurchaseInvoiceById(
    tenantId: string,
    id: string
  ): Promise<PurchaseInvoice | null> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("purchase_invoices")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("id", id)
          .maybeSingle();

        if (!error && data) {
          return data as PurchaseInvoice;
        }
      } catch (err) {
        console.warn("[MarketOS Purchasing] Supabase query error, fallback to memory:", err);
      }
    }

    const found = state.purchaseInvoices.find(
      (inv) => inv.tenant_id === tenantId && inv.id === id
    );
    return found || null;
  }

  /**
   * Save or update a purchase invoice
   */
  static async savePurchaseInvoice(
    tenantId: string,
    invoice: PurchaseInvoice,
    actor?: { id?: string; name?: string; email?: string }
  ): Promise<PurchaseInvoice> {
    const docWithTenant: PurchaseInvoice = {
      ...invoice,
      tenant_id: tenantId,
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from("purchase_invoices").upsert(docWithTenant);
      } catch (err) {
        console.warn("[MarketOS Purchasing] Supabase upsert error, fallback to memory:", err);
      }
    }

    const idx = state.purchaseInvoices.findIndex(
      (inv) => inv.tenant_id === tenantId && inv.id === docWithTenant.id
    );
    if (idx >= 0) {
      state.purchaseInvoices[idx] = docWithTenant;
    } else {
      state.purchaseInvoices.unshift(docWithTenant);
    }

    try {
      await AuditRepository.recordAuditLog({
        tenantId,
        actorId: actor?.id,
        actorName: actor?.name || "Administrador",
        actorEmail: actor?.email,
        actorRole: "ADMIN",
        action: "ORDER_CREATED" as any, // Using existing valid AuditLog action or general
        entity: "purchase_invoice",
        entityId: docWithTenant.id,
        details: `Factura de compra N° ${docWithTenant.invoice_number} registrada para proveedor ${docWithTenant.supplier_name}. Monto: ${docWithTenant.total_amount} ${docWithTenant.currency}`,
        newData: {
          supplier: docWithTenant.supplier_name,
          invoice_number: docWithTenant.invoice_number,
          total: docWithTenant.total_amount,
          retained_vat: docWithTenant.retained_vat_amount,
        },
      });
    } catch (e) {
      // Non-blocking audit error
    }

    return docWithTenant;
  }

  /**
   * List all retention vouchers for a tenant, optionally filtered by tax period (YYYYMM)
   */
  static async getRetentionVouchers(
    tenantId: string,
    taxPeriod?: string
  ): Promise<RetentionVoucher[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        let query = supabase
          .from("retention_vouchers")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("issue_date", { ascending: false });

        if (taxPeriod) {
          query = query.eq("tax_period", taxPeriod);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          return data as RetentionVoucher[];
        }
      } catch (err) {
        console.warn("[MarketOS Retention] Supabase query error, fallback to memory:", err);
      }
    }

    let vouchers = state.retentionVouchers.filter((v) => v.tenant_id === tenantId);
    if (taxPeriod) {
      vouchers = vouchers.filter((v) => v.tax_period === taxPeriod);
    }
    return vouchers.sort(
      (a, b) => new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime()
    );
  }

  /**
   * Save or update a retention voucher
   */
  static async saveRetentionVoucher(
    tenantId: string,
    voucher: RetentionVoucher,
    actor?: { id?: string; name?: string; email?: string }
  ): Promise<RetentionVoucher> {
    const voucherWithTenant: RetentionVoucher = {
      ...voucher,
      tenant_id: tenantId,
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from("retention_vouchers").upsert(voucherWithTenant);
      } catch (err) {
        console.warn("[MarketOS Retention] Supabase upsert error, fallback to memory:", err);
      }
    }

    const idx = state.retentionVouchers.findIndex(
      (v) => v.tenant_id === tenantId && v.id === voucherWithTenant.id
    );
    if (idx >= 0) {
      state.retentionVouchers[idx] = voucherWithTenant;
    } else {
      state.retentionVouchers.unshift(voucherWithTenant);
    }

    try {
      await AuditRepository.recordAuditLog({
        tenantId,
        actorId: actor?.id,
        actorName: actor?.name || "Administrador",
        actorEmail: actor?.email,
        actorRole: "ADMIN",
        action: "ORDER_CREATED" as any,
        entity: "retention_voucher",
        entityId: voucherWithTenant.id,
        details: `Comprobante de retención N° ${voucherWithTenant.voucher_number} emitido para proveedor ${voucherWithTenant.supplier_name}. Monto retenido: ${voucherWithTenant.retained_amount} ${voucherWithTenant.currency}`,
        newData: {
          voucher_number: voucherWithTenant.voucher_number,
          supplier: voucherWithTenant.supplier_name,
          retained_amount: voucherWithTenant.retained_amount,
          tax_period: voucherWithTenant.tax_period,
        },
      });
    } catch (e) {
      // Non-blocking audit error
    }

    return voucherWithTenant;
  }

  /**
   * List all suppliers registered for a tenant
   */
  static async getSuppliers(tenantId: string): Promise<Supplier[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("suppliers")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("name", { ascending: true });

        if (!error && Array.isArray(data)) {
          return data as Supplier[];
        }
      } catch (err) {
        console.warn("[MarketOS Purchasing] Supabase query error, fallback to memory:", err);
      }
    }

    return state.suppliers
      .filter((s) => s.tenant_id === tenantId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Save or update a supplier
   */
  static async saveSupplier(tenantId: string, supplier: Supplier): Promise<Supplier> {
    const supWithTenant: Supplier = {
      ...supplier,
      tenant_id: tenantId,
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from("suppliers").upsert(supWithTenant);
      } catch (err) {
        console.warn("[MarketOS Purchasing] Supabase upsert error, fallback to memory:", err);
      }
    }

    const idx = state.suppliers.findIndex(
      (s) => s.tenant_id === tenantId && s.id === supWithTenant.id
    );
    if (idx >= 0) {
      state.suppliers[idx] = supWithTenant;
    } else {
      state.suppliers.push(supWithTenant);
    }

    return supWithTenant;
  }
}
