"use client";

import React, { useMemo } from "react";
import { CraftWorkshopAdminPanel } from "@marketos/plugin-craft-workshop";
import {
  getCraftMaterialsAction,
  createCraftMaterialAction,
  updateCraftMaterialAction,
  deleteCraftMaterialAction,
  getCraftRecipesAction,
  createCraftRecipeAction,
  updateCraftRecipeAction,
  deleteCraftRecipeAction,
  recalculateCraftRecipesAction,
  publishRecipeToStorefrontAction,
  unpublishRecipeFromStorefrontAction,
  getCraftQuotesAction,
  createCraftQuoteAction,
  convertCraftQuoteToOrderAction,
} from "@/app/admin/craft-actions";

export interface CraftWorkshopAdminProps {
  tenantId: string;
  exchangeRate?: number;
  currencySymbol?: string;
  businessName?: string;
  businessPhone?: string;
}

export function CraftWorkshopAdmin({
  tenantId,
  exchangeRate = 1,
  currencySymbol = "$",
  businessName,
  businessPhone,
}: CraftWorkshopAdminProps) {
  const actions = useMemo(
    () => ({
      getMaterials: (cat?: any) => getCraftMaterialsAction(tenantId, cat),
      createMaterial: (input: any) => createCraftMaterialAction(tenantId, input),
      updateMaterial: (input: any) => updateCraftMaterialAction(tenantId, input),
      deleteMaterial: (id: string) => deleteCraftMaterialAction(tenantId, id),
      getRecipes: (opt?: any) => getCraftRecipesAction(tenantId, opt),
      createRecipe: (input: any) => createCraftRecipeAction(tenantId, input),
      updateRecipe: (input: any) => updateCraftRecipeAction(tenantId, input),
      deleteRecipe: (id: string) => deleteCraftRecipeAction(tenantId, id),
      recalculateRecipes: (sync?: boolean) => recalculateCraftRecipesAction(tenantId, sync),
      publishRecipe: (id: string) => publishRecipeToStorefrontAction(tenantId, id),
      unpublishRecipe: (id: string) => unpublishRecipeFromStorefrontAction(tenantId, id),
      getQuotes: (limit?: number) => getCraftQuotesAction(tenantId, limit),
      createQuote: (input: any) => createCraftQuoteAction(tenantId, input),
      convertQuoteToOrder: (id: string) => convertCraftQuoteToOrderAction(tenantId, id),
    }),
    [tenantId]
  );

  return (
    <CraftWorkshopAdminPanel
      tenantId={tenantId}
      exchangeRate={exchangeRate}
      currencySymbol={currencySymbol}
      businessName={businessName}
      businessPhone={businessPhone}
      actions={actions}
    />
  );
}
