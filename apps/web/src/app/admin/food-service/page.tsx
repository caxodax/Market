import React from "react";
import { resolveAuthorizedAdminContext, assertTenantModuleActive } from "../admin-context";
import { MarketOSRepository } from "@marketos/database";
import { FoodServiceView } from "@/components/food-service-view";

export const dynamic = "force-dynamic";

export default async function AdminFoodServicePage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const params = await searchParams;
  const context = await resolveAuthorizedAdminContext(params);

  await assertTenantModuleActive(context.targetTenantId, "food_service");

  const [rawMaterials, recipes, modifierGroups, products, categories] = await Promise.all([
    MarketOSRepository.getRawMaterials(context.targetTenantId),
    MarketOSRepository.getProductRecipes(context.targetTenantId),
    MarketOSRepository.getProductModifierGroups(context.targetTenantId),
    MarketOSRepository.getProducts(context.targetTenantId, undefined, undefined, 100),
    MarketOSRepository.getCategories(context.targetTenantId),
  ]);

  return (
    <FoodServiceView
      settings={context.settings}
      stores={context.stores}
      products={products}
      categories={categories}
      initialRawMaterials={rawMaterials}
      initialRecipes={recipes}
      initialModifierGroups={modifierGroups}
    />
  );
}
