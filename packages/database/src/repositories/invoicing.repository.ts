import type { FiscalDocument, FiscalDocumentType } from "@marketos/types";
import { state } from "../mock-data.ts";
import { getSupabase } from "./base.ts";
import { AuditRepository } from "./audit.repository.ts";

export class InvoicingRepository {
  /**
   * List all fiscal documents for a tenant, optionally filtered by document type
   */
  static async getFiscalDocuments(
    tenantId: string,
    filterType?: FiscalDocumentType
  ): Promise<FiscalDocument[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        let query = supabase
          .from("fiscal_documents")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false });

        if (filterType) {
          query = query.eq("document_type", filterType);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          return data as FiscalDocument[];
        }
      } catch (err) {
        console.warn("[MarketOS Invoicing] Error querying fiscal_documents from Supabase, using memory fallback:", err);
      }
    }

    // Memory fallback
    let docs = state.fiscalDocuments.filter((d) => d.tenant_id === tenantId);
    if (filterType) {
      docs = docs.filter((d) => d.document_type === filterType);
    }
    return docs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * Get a single fiscal document by ID
   */
  static async getFiscalDocumentById(
    tenantId: string,
    id: string
  ): Promise<FiscalDocument | null> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("fiscal_documents")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("id", id)
          .maybeSingle();

        if (!error && data) {
          return data as FiscalDocument;
        }
      } catch (err) {
        console.warn("[MarketOS Invoicing] Error fetching fiscal document by ID:", err);
      }
    }

    return state.fiscalDocuments.find((d) => d.tenant_id === tenantId && d.id === id) || null;
  }

  /**
   * Get a single fiscal document by Document Number (e.g. FACT-000001)
   */
  static async getFiscalDocumentByNumber(
    tenantId: string,
    documentNumber: string
  ): Promise<FiscalDocument | null> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("fiscal_documents")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("document_number", documentNumber)
          .maybeSingle();

        if (!error && data) {
          return data as FiscalDocument;
        }
      } catch (err) {
        console.warn("[MarketOS Invoicing] Error fetching fiscal document by number:", err);
      }
    }

    return (
      state.fiscalDocuments.find(
        (d) => d.tenant_id === tenantId && d.document_number === documentNumber
      ) || null
    );
  }

  /**
   * Count total documents for generating sequence numbers
   */
  static async countFiscalDocuments(
    tenantId: string,
    filterType?: FiscalDocumentType
  ): Promise<number> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        let query = supabase
          .from("fiscal_documents")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId);

        if (filterType) {
          query = query.eq("document_type", filterType);
        }

        const { count, error } = await query;
        if (!error && typeof count === "number") {
          return count;
        }
      } catch {
        // Fallback to memory
      }
    }

    const inMemory = state.fiscalDocuments.filter((d) => {
      if (d.tenant_id !== tenantId) return false;
      if (filterType) return d.document_type === filterType;
      return true;
    });
    return inMemory.length;
  }

  /**
   * Persist a prepared FiscalDocument and handle inventory replenishment if Credit Note
   */
  static async saveFiscalDocument(
    tenantId: string,
    doc: FiscalDocument,
    actor?: { id?: string; name?: string; role?: string; email?: string }
  ): Promise<FiscalDocument> {
    // 1. In-memory append
    const existingIndex = state.fiscalDocuments.findIndex(
      (d) => d.tenant_id === tenantId && d.id === doc.id
    );
    if (existingIndex >= 0) {
      state.fiscalDocuments[existingIndex] = doc;
    } else {
      state.fiscalDocuments.unshift(doc);
    }

    // 2. Replenish inventory if Credit Note with return_items_to_inventory enabled
    if (doc.document_type === "CREDIT_NOTE" && doc.return_items_to_inventory && doc.items.length > 0) {
      await this.replenishInventoryFromCreditNote(tenantId, doc);
    }

    // 3. Supabase persistence
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from("fiscal_documents").upsert({
          id: doc.id,
          tenant_id: doc.tenant_id,
          order_id: doc.order_id,
          document_type: doc.document_type,
          document_number: doc.document_number,
          control_number: doc.control_number,
          affected_document_id: doc.affected_document_id,
          affected_document_number: doc.affected_document_number,
          status: doc.status,
          reason: doc.reason,
          return_items_to_inventory: doc.return_items_to_inventory,
          customer_name: doc.customer_name,
          customer_id_doc: doc.customer_id_doc,
          customer_address: doc.customer_address,
          customer_phone: doc.customer_phone,
          emitter_business_name: doc.emitter_business_name,
          emitter_id_doc: doc.emitter_id_doc,
          emitter_address: doc.emitter_address,
          items: doc.items,
          subtotal_exempt: doc.subtotal_exempt,
          subtotal_taxable: doc.subtotal_taxable,
          iva_rate_percent: doc.iva_rate_percent,
          iva_amount: doc.iva_amount,
          igtf_rate_percent: doc.igtf_rate_percent,
          igtf_amount: doc.igtf_amount,
          total_amount: doc.total_amount,
          total_ves: doc.total_ves,
          exchange_rate_applied: doc.exchange_rate_applied,
          currency: doc.currency,
          transport_info: doc.transport_info,
          qr_data: doc.qr_data,
          legal_legend: doc.legal_legend,
          created_at: doc.created_at,
          created_by: doc.created_by,
        });
      } catch (err) {
        console.warn("[MarketOS Invoicing] Warning: Could not upsert to Supabase fiscal_documents:", err);
      }
    }

    // 4. Audit Log
    try {
      await AuditRepository.recordAuditLog({
        tenantId,
        actorId: actor?.id,
        actorName: actor?.name || doc.created_by || "Admin Operativo",
        actorEmail: actor?.email,
        actorRole: actor?.role || "OPERATOR",
        action: "FISCAL_DOCUMENT_ISSUED" as any,
        entity: "fiscal_document",
        entityId: doc.id,
        details: `Emitido ${doc.document_number} (${doc.document_type}) para ${doc.customer_name} por $${doc.total_amount.toFixed(2)}${
          doc.return_items_to_inventory ? " (Inventario Repuesto)" : ""
        }`,
        newData: {
          document_number: doc.document_number,
          document_type: doc.document_type,
          total_amount: doc.total_amount,
          affected_document_number: doc.affected_document_number,
          return_items_to_inventory: doc.return_items_to_inventory,
        },
      });
    } catch {
      // Ignore audit failure
    }

    return doc;
  }

  /**
   * Restores items back into stock when a Credit Note is issued with return flag
   */
  private static async replenishInventoryFromCreditNote(
    tenantId: string,
    doc: FiscalDocument
  ): Promise<void> {
    const supabase = getSupabase();

    for (const item of doc.items) {
      if (!item.product_id || item.quantity <= 0) continue;

      // In-memory stock increment
      const prod = state.products.find(
        (p) => p.tenant_id === tenantId && p.id === item.product_id
      );
      if (prod && typeof prod.stock === "number") {
        prod.stock += item.quantity;
      }

      // Supabase stock increment
      if (supabase) {
        try {
          const { data: inv } = await supabase
            .from("inventory")
            .select("id, quantity, store_id")
            .eq("tenant_id", tenantId)
            .eq("product_id", item.product_id)
            .maybeSingle();

          if (inv) {
            const newQty = inv.quantity + item.quantity;
            await supabase
              .from("inventory")
              .update({
                quantity: newQty,
                updated_at: new Date().toISOString(),
              })
              .eq("id", inv.id);

            await supabase.from("inventory_movements").insert({
              tenant_id: tenantId,
              store_id: inv.store_id,
              product_id: item.product_id,
              quantity_change: item.quantity,
              previous_quantity: inv.quantity,
              new_quantity: newQty,
              reason: "CREDIT_NOTE_RETURN",
            });
          }
        } catch (err) {
          console.warn("[MarketOS Invoicing] Inventory replenishment error for product", item.product_id, err);
        }
      }
    }
  }
}
