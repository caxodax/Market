"use client";

import React, { useState } from "react";
import {
  TenantSettings,
  TenantModuleId,
  PurchaseInvoice,
  RetentionVoucher,
  Supplier,
  CreatePurchaseInvoiceInput,
} from "@marketos/types";
import { PurchasingManagerAdmin } from "@marketos/plugin-purchasing-retentions";
import {
  registerPurchaseInvoiceAction,
  generateSeniatTxtAction,
} from "@/app/admin/purchasing-actions";
import { toast } from "sonner";

interface PurchasingViewProps {
  settings: TenantSettings;
  activeModuleIds: TenantModuleId[];
  initialInvoices: PurchaseInvoice[];
  initialVouchers: RetentionVoucher[];
  initialSuppliers: Supplier[];
  defaultExchangeRate: number;
}

export function PurchasingView({
  settings,
  activeModuleIds,
  initialInvoices,
  initialVouchers,
  initialSuppliers,
  defaultExchangeRate,
}: PurchasingViewProps) {
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>(initialInvoices);
  const [retentionVouchers, setRetentionVouchers] = useState<RetentionVoucher[]>(initialVouchers);

  const handleRegisterPurchase = async (input: CreatePurchaseInvoiceInput) => {
    try {
      const res = await registerPurchaseInvoiceAction(settings.tenant_id, input);
      if (res?.success && res.invoice) {
        setPurchaseInvoices((prev) => [res.invoice!, ...prev]);
        if (res.voucher) {
          setRetentionVouchers((prev) => [res.voucher!, ...prev]);
        }
        toast.success(`Factura de compra registrada: ${res.invoice.invoice_number}`);
      } else {
        toast.error(res?.error || "Error al registrar compra");
      }
      return res;
    } catch {
      toast.error("Error de comunicación al registrar compra");
      return { success: false, error: "Error de comunicación" };
    }
  };

  const handleDownloadSeniatTxt = async (taxPeriod: string) => {
    return await generateSeniatTxtAction(settings.tenant_id, taxPeriod);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-view-enter">
      <PurchasingManagerAdmin
        tenantId={settings.tenant_id}
        settings={settings}
        activeModuleIds={activeModuleIds}
        initialInvoices={purchaseInvoices}
        initialVouchers={retentionVouchers}
        initialSuppliers={initialSuppliers}
        defaultExchangeRate={defaultExchangeRate}
        onRegisterPurchase={handleRegisterPurchase}
        onDownloadSeniatTxt={handleDownloadSeniatTxt}
      />
    </div>
  );
}
