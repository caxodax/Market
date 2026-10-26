"use server";

import { revalidatePath } from "next/cache";
import {
  MarketOSRepository,
  PurchasingRepository,
} from "@marketos/database";
import {
  preparePurchaseInvoice,
  buildSeniatRetentionTxt,
} from "@marketos/plugin-purchasing-retentions";
import type {
  CreatePurchaseInvoiceInput,
  PurchaseInvoice,
  RetentionVoucher,
  Supplier,
  SeniatRetentionTxtRow,
} from "@marketos/types";
import { assertAuthorizedTenantAdmin } from "./actions";

/**
 * Fetch all registered purchase invoices for a tenant
 */
export async function getPurchaseInvoicesAction(
  tenantId: string
): Promise<PurchaseInvoice[]> {
  await assertAuthorizedTenantAdmin(tenantId);
  return await PurchasingRepository.getPurchaseInvoices(tenantId);
}

/**
 * Fetch all retention vouchers for a tenant, optionally filtered by tax period (YYYYMM)
 */
export async function getRetentionVouchersAction(
  tenantId: string,
  taxPeriod?: string
): Promise<RetentionVoucher[]> {
  await assertAuthorizedTenantAdmin(tenantId);
  return await PurchasingRepository.getRetentionVouchers(tenantId, taxPeriod);
}

/**
 * Fetch all suppliers for a tenant
 */
export async function getSuppliersAction(
  tenantId: string
): Promise<Supplier[]> {
  await assertAuthorizedTenantAdmin(tenantId);
  return await PurchasingRepository.getSuppliers(tenantId);
}

/**
 * Register a purchase invoice and automatically generate a retention voucher if applicable
 */
export async function registerPurchaseInvoiceAction(
  tenantId: string,
  input: CreatePurchaseInvoiceInput
): Promise<{
  success: boolean;
  invoice?: PurchaseInvoice;
  voucher?: RetentionVoucher;
  error?: string;
}> {
  try {
    const user = await assertAuthorizedTenantAdmin(tenantId);

    // 1. Get tenant settings & active modules
    const settings = await MarketOSRepository.getTenantSettings(tenantId);
    if (!settings) {
      return { success: false, error: "No se encontró la configuración del comercio." };
    }

    const tenantModules = await MarketOSRepository.getTenantModules(tenantId);
    const activeModuleIds = tenantModules
      .filter((m) => m.is_active)
      .map((m) => m.module_id);

    // 2. Count existing vouchers for sequence numbering
    const currentVouchers = await PurchasingRepository.getRetentionVouchers(tenantId);

    // 3. Prepare invoice and retention voucher using decoupled engine
    const { invoice, retentionVoucher } = preparePurchaseInvoice({
      input,
      settings,
      existingCount: currentVouchers.length,
      activeModuleIds,
      actorName: user.full_name || user.email || "Admin",
      defaultIvaRate: activeModuleIds.includes("local_chile") ? 19.0 : 16.0,
    });

    // 4. Save supplier if not existing
    const existingSuppliers = await PurchasingRepository.getSuppliers(tenantId);
    const foundSupplier = existingSuppliers.find((s) => s.tax_id === input.supplier_tax_id);
    if (!foundSupplier) {
      await PurchasingRepository.saveSupplier(tenantId, {
        id: `sup_${input.supplier_tax_id.replace(/[^A-Za-z0-9]/g, "")}`,
        tenant_id: tenantId,
        name: input.supplier_name,
        tax_id: input.supplier_tax_id,
        phone: input.supplier_phone || null,
        address: input.supplier_address || null,
        default_retention_rate: input.retention_rate_percent,
        created_at: new Date().toISOString(),
      });
    }

    // 5. Persist purchase invoice
    const savedInvoice = await PurchasingRepository.savePurchaseInvoice(tenantId, invoice, {
      id: user.id,
      name: user.full_name,
      email: user.email,
    });

    // 6. Persist retention voucher if generated
    let savedVoucher: RetentionVoucher | undefined = undefined;
    if (retentionVoucher) {
      savedVoucher = await PurchasingRepository.saveRetentionVoucher(tenantId, retentionVoucher, {
        id: user.id,
        name: user.full_name,
        email: user.email,
      });
    }

    revalidatePath("/admin");
    return { success: true, invoice: savedInvoice, voucher: savedVoucher };
  } catch (err: any) {
    console.error("[Purchasing Action Error]:", err);
    return { success: false, error: err?.message || "Error al registrar la factura de compra." };
  }
}

/**
 * Generate official SENIAT TXT file content for tax period (YYYYMM)
 */
export async function generateSeniatTxtAction(
  tenantId: string,
  taxPeriod: string
): Promise<{
  success: boolean;
  content?: string;
  filename?: string;
  error?: string;
}> {
  try {
    await assertAuthorizedTenantAdmin(tenantId);

    const cleanPeriod = taxPeriod.replace(/[^0-9]/g, "").slice(0, 6);
    if (cleanPeriod.length !== 6) {
      return { success: false, error: "El período fiscal debe tener formato YYYYMM (6 dígitos)." };
    }

    const vouchers = await PurchasingRepository.getRetentionVouchers(tenantId, cleanPeriod);
    if (vouchers.length === 0) {
      return {
        success: false,
        error: `No se encontraron comprobantes de retención para el período fiscal ${cleanPeriod}.`,
      };
    }

    const settings = await MarketOSRepository.getTenantSettings(tenantId);
    const agentRif =
      settings?.billing_settings?.emitter_fiscal_data?.rif || "J-00000000-0";

    const rows: SeniatRetentionTxtRow[] = vouchers.map((v) => {
      const rate = v.exchange_rate_applied || 1;
      return {
        agentRif: v.agent_tax_id || agentRif,
        taxPeriod: v.tax_period,
        invoiceDate: v.invoice_date,
        operationType: "C",
        documentType: "01",
        supplierRif: v.supplier_tax_id,
        invoiceNumber: v.invoice_number,
        controlNumber: v.control_number || "00-000000",
        totalAmountVes: Number((v.invoice_total_amount * rate).toFixed(2)),
        taxableBaseVes: Number((v.taxable_base_amount * rate).toFixed(2)),
        retainedAmountVes: Number((v.retained_amount * rate).toFixed(2)),
        affectedInvoiceNumber: "0",
        voucherNumber: v.voucher_number,
        exemptAmountVes: Number((v.exempt_base_amount * rate).toFixed(2)),
        ivaRatePercent: v.iva_rate_percent,
        fileNumber: "0",
      };
    });

    const content = buildSeniatRetentionTxt(rows);
    const filename = `RET_IVA_${cleanPeriod}_${agentRif.replace(/[^A-Za-z0-9]/g, "")}.txt`;

    return { success: true, content, filename };
  } catch (err: any) {
    console.error("[SENIAT TXT Action Error]:", err);
    return { success: false, error: err?.message || "Error al generar el archivo TXT para el SENIAT." };
  }
}
