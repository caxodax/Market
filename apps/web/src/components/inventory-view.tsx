"use client";

import React, { useState } from "react";
import {
  Product,
  Category,
  ExchangeRate,
  TenantSettings,
  TenantPlanLimits,
} from "@marketos/types";
import { InventoryTab } from "./inventory-tab";
import { ProductModal } from "./product-modal";
import { PlanUpgradeModal } from "./plan-upgrade-modal";
import { adjustStockAction } from "@/app/admin/actions";
import { toast } from "sonner";

interface InventoryViewProps {
  initialProducts: (Product & { stock: number })[];
  initialCategories: Category[];
  rate: ExchangeRate;
  settings: TenantSettings;
  planLimits: TenantPlanLimits | null;
  activeModuleIds: string[];
}

export function InventoryView({
  initialProducts,
  initialCategories,
  rate,
  settings,
  planLimits,
  activeModuleIds,
}: InventoryViewProps) {
  const [products, setProducts] = useState<(Product & { stock: number })[]>(initialProducts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [editingProduct, setEditingProduct] = useState<(Product & { stock: number }) | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const handleStockChange = async (productId: string, delta: number) => {
    try {
      const res = await adjustStockAction(settings.tenant_id, productId, delta);
      if (res?.success && res.newStock !== undefined) {
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, stock: res.newStock! } : p))
        );
        toast.success("Stock ajustado correctamente");
      } else {
        toast.error(res?.error || "Error al modificar stock");
      }
    } catch {
      toast.error("Error de comunicación al actualizar stock");
    }
  };

  const handleProductSaved = (savedProduct: Product & { stock: number }) => {
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === savedProduct.id);
      if (exists) {
        return prev.map((p) => (p.id === savedProduct.id ? savedProduct : p));
      }
      return [savedProduct, ...prev];
    });
    setIsProductModalOpen(false);
    setEditingProduct(null);
    toast.success("Producto guardado exitosamente");
  };

  const handleProductDeleted = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    setIsProductModalOpen(false);
    setEditingProduct(null);
    toast.success("Producto eliminado del inventario");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-view-enter">
      <InventoryTab
        tenantId={settings.tenant_id}
        products={products}
        categories={categories}
        rate={rate}
        currencySettings={settings.currency_settings}
        activeModuleIds={activeModuleIds}
        planLimitsState={planLimits}
        onStockChange={handleStockChange}
        onEditProduct={(prod) => {
          setEditingProduct(prod);
          setIsProductModalOpen(true);
        }}
        onNewProduct={() => {
          setEditingProduct(null);
          setIsProductModalOpen(true);
        }}
        onTriggerUpgrade={() => setIsUpgradeModalOpen(true)}
        onProductsImported={() => {
          window.location.reload();
        }}
        onCategoriesChanged={(updated) => setCategories(updated)}
      />

      {/* Product Creation / Edit Modal */}
      {isProductModalOpen && (
        <ProductModal
          key={editingProduct ? editingProduct.id : "new-product"}
          tenantId={settings.tenant_id}
          categories={categories}
          product={editingProduct}
          isOpen={isProductModalOpen}
          onClose={() => {
            setIsProductModalOpen(false);
            setEditingProduct(null);
          }}
          onSaved={handleProductSaved}
          onDeleted={handleProductDeleted}
          onQuotaExceeded={() => setIsUpgradeModalOpen(true)}
          onCategoryCreated={(newCat) =>
            setCategories((prev) =>
              prev.some(
                (c) =>
                  c.id === newCat.id ||
                  (c.slug && c.slug.toLowerCase().trim() === (newCat.slug || "").toLowerCase().trim()) ||
                  c.name.toLowerCase().trim() === newCat.name.toLowerCase().trim()
              )
                ? prev
                : [...prev, newCat]
            )
          }
        />
      )}

      {/* Plan Upgrade Modal */}
      {isUpgradeModalOpen && planLimits && (
        <PlanUpgradeModal
          isOpen={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
          tenantName={settings.business_name}
          tenantId={settings.tenant_id}
          planLimits={planLimits}
          quotaType="products"
        />
      )}
    </div>
  );
}
