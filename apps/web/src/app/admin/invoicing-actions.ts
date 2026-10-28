"use server";

import { revalidatePath } from "next/cache";
import {
  MarketOSRepository,
  InvoicingRepository,
} from "@marketos/database";
import { prepareFiscalDocument } from "@marketos/plugin-invoicing";
import type {
  CreateFiscalDocumentInput,
  FiscalDocument,
  FiscalDocumentType,
} from "@marketos/types";
import { assertAuthorizedTenantAdmin } from "./actions";

/**
 * Fetch all fiscal documents (invoices, credit notes, dispatch guides, etc.)
 */
export async function getFiscalDocumentsAction(
  tenantId: string,
  filterType?: FiscalDocumentType
): Promise<FiscalDocument[]> {
  await assertAuthorizedTenantAdmin(tenantId);
  return await InvoicingRepository.getFiscalDocuments(tenantId, filterType);
}

/**
 * Fetch existing invoices that can be affected by Credit Notes or Debit Notes
 */
export async function getAvailableInvoicesAction(
  tenantId: string
): Promise<FiscalDocument[]> {
  await assertAuthorizedTenantAdmin(tenantId);
  const docs = await InvoicingRepository.getFiscalDocuments(tenantId, "INVOICE");
  return docs.filter((d) => d.status === "ISSUED");
}

/**
 * Issue a new Fiscal Document with multi-country rules, control numbering & inventory restoration
 */
export async function issueFiscalDocumentAction(
  tenantId: string,
  input: CreateFiscalDocumentInput
): Promise<{ success: boolean; document?: FiscalDocument; error?: string }> {
  try {
    const user = await assertAuthorizedTenantAdmin(tenantId);

    // 1. Obtain tenant settings and active modules
    const settings = await MarketOSRepository.getTenantSettings(tenantId);
    if (!settings) {
      return { success: false, error: "No se encontró la configuración del comercio." };
    }

    const tenantModules = await MarketOSRepository.getTenantModules(tenantId);
    const activeModuleIds = tenantModules
      .filter((m) => m.is_active)
      .map((m) => m.module_id);

    // 2. Atomic fiscal sequence numbering (Zero race conditions)
    const nextSequence = await InvoicingRepository.getNextFiscalSequence(tenantId, input.document_type);

    // 3. Resolve affected invoice if this is a Credit Note or Debit Note
    let affectedInvoice: FiscalDocument | null = null;
    if (input.document_type === "CREDIT_NOTE" || input.document_type === "DEBIT_NOTE") {
      if (input.affected_document_id) {
        affectedInvoice = await InvoicingRepository.getFiscalDocumentById(
          tenantId,
          input.affected_document_id
        );
      } else if (input.affected_document_number) {
        affectedInvoice = await InvoicingRepository.getFiscalDocumentByNumber(
          tenantId,
          input.affected_document_number
        );
      }
    }

    // 4. Prepare and calculate fiscal document via decoupled adapter
    const preparedDoc = prepareFiscalDocument({
      input,
      settings,
      sequenceNumber: nextSequence,
      activeModuleIds,
      actorName: user.full_name || user.email || "Admin",
      affectedInvoice,
    });

    // 5. Persist document & replenish inventory if applicable
    const savedDoc = await InvoicingRepository.saveFiscalDocument(tenantId, preparedDoc, {
      id: user.id,
      name: user.full_name,
      email: user.email,
      role: user.role,
    });

    revalidatePath("/admin");
    return { success: true, document: savedDoc };
  } catch (err: any) {
    console.error("[Invoicing Action Error]:", err);
    return { success: false, error: err?.message || "Error al emitir el documento comercial." };
  }
}
