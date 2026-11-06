"use client";

import React, { useState } from "react";
import {
  TenantSettings,
  TenantModuleId,
  FiscalDocument,
  Order,
  Driver,
  CreateFiscalDocumentInput,
} from "@marketos/types";
import { InvoicingManagerAdmin } from "@marketos/plugin-invoicing";
import { issueFiscalDocumentAction } from "@/app/admin/invoicing-actions";
import { toast } from "sonner";

interface InvoicingViewProps {
  settings: TenantSettings;
  activeModuleIds: TenantModuleId[];
  initialDocuments: FiscalDocument[];
  orders: Order[];
  drivers: Driver[];
}

export function InvoicingView({
  settings,
  activeModuleIds,
  initialDocuments,
  orders,
  drivers,
}: InvoicingViewProps) {
  const [fiscalDocuments, setFiscalDocuments] = useState<FiscalDocument[]>(initialDocuments);

  const handleIssueDocument = async (input: CreateFiscalDocumentInput) => {
    try {
      const res = await issueFiscalDocumentAction(settings.tenant_id, input);
      if (res?.success && res.document) {
        setFiscalDocuments((prev) => [res.document!, ...prev]);
        toast.success(`Documento emitido: ${res.document.document_number}`);
      } else {
        toast.error(res?.error || "Error al emitir documento fiscal");
      }
      return res;
    } catch {
      toast.error("Error de comunicación al emitir documento fiscal");
      return { success: false, error: "Error de comunicación" };
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-view-enter">
      <InvoicingManagerAdmin
        tenantId={settings.tenant_id}
        settings={settings}
        activeModuleIds={activeModuleIds}
        initialDocuments={fiscalDocuments}
        orders={orders}
        availableDrivers={drivers.map((d) => ({
          id: d.id,
          name: d.name,
          phone: d.phone,
          vehicle_plate: d.plate_number || undefined,
        }))}
        onIssueDocument={handleIssueDocument}
      />
    </div>
  );
}
