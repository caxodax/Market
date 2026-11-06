"use client";

import React, { useState } from "react";
import {
  TenantSettings,
  Category,
  Product,
  Store,
  ExchangeRate,
} from "@marketos/types";
import { AdminStorefrontStudio } from "@marketos/plugin-storefront-pro";
import { updateTenantSettingsAction } from "@/app/admin/actions";
import { toast } from "sonner";

interface StorefrontStudioViewProps {
  settings: TenantSettings;
  categories: Category[];
  products: (Product & { stock: number })[];
  stores: Store[];
  exchangeRate: ExchangeRate;
}

export function StorefrontStudioView({
  settings,
  categories,
  products,
  stores,
  exchangeRate,
}: StorefrontStudioViewProps) {
  const [currentSettings, setCurrentSettings] = useState<TenantSettings>(settings);

  const handleSave = async (newConfig: any) => {
    try {
      const res = await updateTenantSettingsAction(currentSettings.tenant_id, {
        storefront_config: newConfig,
      });
      if (res?.success && res.settings) {
        setCurrentSettings(res.settings);
        toast.success("Vitrina visual actualizada exitosamente");
      } else {
        toast.error(res?.error || "Error al guardar vitrina");
      }
    } catch {
      toast.error("Error de comunicación al guardar diseño de vitrina");
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-view-enter space-y-6">
      <AdminStorefrontStudio
        initialConfig={currentSettings.storefront_config}
        businessName={currentSettings.business_name}
        categories={categories}
        products={products}
        stores={stores}
        exchangeRate={exchangeRate}
        onSave={handleSave}
      />
    </div>
  );
}
