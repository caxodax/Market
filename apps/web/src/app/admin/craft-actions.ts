"use server";

import { MarketOSRepository } from "@marketos/database";
import type {
  CraftMaterial,
  CraftMaterialCategory,
  CreateCraftMaterialInput,
  UpdateCraftMaterialInput,
  CraftRecipe,
  CreateCraftRecipeInput,
  UpdateCraftRecipeInput,
  WorkshopTechnique,
  CraftQuote,
  CreateCraftQuoteInput,
  CraftQuoteStatus,
  RecalculateCraftRecipesResult,
  DeliveryType,
  AuditActor,
  Product,
  Order,
} from "@marketos/types";
import { revalidatePath } from "next/cache";
import { invalidateProductsCache } from "@/lib/cached-queries";
import { assertAuthorizedTenantAdmin } from "./actions";
import { getCurrentUser } from "../login/actions";

async function getCraftAuditActor(): Promise<AuditActor> {
  const user = await getCurrentUser();
  if (user) {
    const isImpersonating = Boolean(user.impersonation);
    return {
      id: user.id,
      name: isImpersonating
        ? `${user.full_name} (Soporte / Impersonando Dueño)`
        : user.full_name,
      email: user.email,
      role: isImpersonating ? "PLATFORM_SUPER_ADMIN" : user.role,
    };
  }
  return {
    id: null,
    name: "Admin Taller",
    email: null,
    role: "OPERATOR",
  };
}

// =============================================================================
// 1. INSUMOS MAESTROS / MATERIA PRIMA (craft_materials)
// =============================================================================

export async function getCraftMaterialsAction(
  tenantId: string,
  category?: CraftMaterialCategory
): Promise<{ success: boolean; data?: CraftMaterial[]; error?: string }> {
  try {
    await assertAuthorizedTenantAdmin(tenantId);
    const materials = await MarketOSRepository.getCraftMaterials(tenantId, category);
    return { success: true, data: materials };
  } catch (error) {
    console.error("[craft-actions] getCraftMaterialsAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al obtener insumos",
    };
  }
}

export async function createCraftMaterialAction(
  tenantId: string,
  input: Omit<CreateCraftMaterialInput, "tenantId">
): Promise<{ success: boolean; material?: CraftMaterial; error?: string }> {
  try {
    await assertAuthorizedTenantAdmin(tenantId);
    const actor = await getCraftAuditActor();
    const material = await MarketOSRepository.createCraftMaterial({
      ...input,
      tenantId,
      actor,
    });

    if (!material) {
      return { success: false, error: "No se pudo crear el insumo en el taller" };
    }

    revalidatePath("/admin");
    return { success: true, material };
  } catch (error) {
    console.error("[craft-actions] createCraftMaterialAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al registrar insumo",
    };
  }
}

export async function updateCraftMaterialAction(
  tenantId: string,
  input: Omit<UpdateCraftMaterialInput, "tenantId">
): Promise<{ success: boolean; material?: CraftMaterial; error?: string }> {
  try {
    await assertAuthorizedTenantAdmin(tenantId);
    const actor = await getCraftAuditActor();
    const material = await MarketOSRepository.updateCraftMaterial({
      ...input,
      tenantId,
      actor,
    });

    if (!material) {
      return { success: false, error: "No se pudo actualizar el insumo" };
    }

    revalidatePath("/admin");
    return { success: true, material };
  } catch (error) {
    console.error("[craft-actions] updateCraftMaterialAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al actualizar insumo",
    };
  }
}

export async function deleteCraftMaterialAction(
  tenantId: string,
  materialId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertAuthorizedTenantAdmin(tenantId);
    const actor = await getCraftAuditActor();
    const ok = await MarketOSRepository.deleteCraftMaterial(tenantId, materialId, actor);

    if (!ok) {
      return { success: false, error: "No se pudo desactivar el insumo" };
    }

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("[craft-actions] deleteCraftMaterialAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al eliminar insumo",
    };
  }
}

// =============================================================================
// 2. RECETAS / ESCANDALLOS TÉCNICOS (craft_recipes + craft_recipe_items)
// =============================================================================

export async function getCraftRecipesAction(
  tenantId: string,
  options?: { technique?: WorkshopTechnique; isActive?: boolean }
): Promise<{ success: boolean; data?: CraftRecipe[]; error?: string }> {
  try {
    await assertAuthorizedTenantAdmin(tenantId);
    const recipes = await MarketOSRepository.getCraftRecipes(tenantId, options);
    return { success: true, data: recipes };
  } catch (error) {
    console.error("[craft-actions] getCraftRecipesAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al obtener recetas",
    };
  }
}

export async function getCraftRecipeByIdAction(
  tenantId: string,
  recipeId: string
): Promise<{ success: boolean; recipe?: CraftRecipe | null; error?: string }> {
  try {
    await assertAuthorizedTenantAdmin(tenantId);
    const recipe = await MarketOSRepository.getCraftRecipeById(tenantId, recipeId);
    return { success: true, recipe };
  } catch (error) {
    console.error("[craft-actions] getCraftRecipeByIdAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al buscar receta",
    };
  }
}

export async function createCraftRecipeAction(
  tenantId: string,
  input: Omit<CreateCraftRecipeInput, "tenantId">
): Promise<{ success: boolean; recipe?: CraftRecipe; error?: string }> {
  try {
    await assertAuthorizedTenantAdmin(tenantId);
    const recipe = await MarketOSRepository.createCraftRecipe({
      ...input,
      tenantId,
    });

    if (!recipe) {
      return { success: false, error: "No se pudo guardar la receta técnica" };
    }

    revalidatePath("/admin");
    return { success: true, recipe };
  } catch (error) {
    console.error("[craft-actions] createCraftRecipeAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al registrar receta",
    };
  }
}

export async function updateCraftRecipeAction(
  tenantId: string,
  input: Omit<UpdateCraftRecipeInput, "tenantId">
): Promise<{ success: boolean; recipe?: CraftRecipe; error?: string }> {
  try {
    await assertAuthorizedTenantAdmin(tenantId);
    const recipe = await MarketOSRepository.updateCraftRecipe({
      ...input,
      tenantId,
    });

    if (!recipe) {
      return { success: false, error: "No se pudo actualizar la receta" };
    }

    if (recipe.is_published && recipe.product_id) {
      invalidateProductsCache(tenantId);
      revalidatePath(`/t/${tenantId}`);
      revalidatePath("/t/[tenant]", "page");
    }

    revalidatePath("/admin");
    return { success: true, recipe };
  } catch (error) {
    console.error("[craft-actions] updateCraftRecipeAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al actualizar receta",
    };
  }
}

export async function deleteCraftRecipeAction(
  tenantId: string,
  recipeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertAuthorizedTenantAdmin(tenantId);
    const ok = await MarketOSRepository.deleteCraftRecipe(tenantId, recipeId);

    if (!ok) {
      return { success: false, error: "No se pudo desactivar la receta" };
    }

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("[craft-actions] deleteCraftRecipeAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al eliminar receta",
    };
  }
}

export async function recalculateCraftRecipesAction(
  tenantId: string,
  syncStorefront = false
): Promise<{ success: boolean; result?: RecalculateCraftRecipesResult; error?: string }> {
  try {
    await assertAuthorizedTenantAdmin(tenantId);
    const result = await MarketOSRepository.recalculateCraftRecipes(tenantId, syncStorefront);

    if (syncStorefront && result.synced_products > 0) {
      invalidateProductsCache(tenantId);
      revalidatePath(`/t/${tenantId}`);
      revalidatePath("/t/[tenant]", "page");
    }

    revalidatePath("/admin");
    return { success: true, result };
  } catch (error) {
    console.error("[craft-actions] recalculateCraftRecipesAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al recalcular recetas",
    };
  }
}

// =============================================================================
// 3. SINCRONIZACIÓN CON VITRINA STOREFRONT (PUBLICACIÓN OPCIONAL)
// =============================================================================

export async function publishRecipeToStorefrontAction(
  tenantId: string,
  recipeId: string,
  options?: {
    categoryId?: string;
    imageUrl?: string;
    description?: string;
  }
): Promise<{ success: boolean; product?: Product; recipe?: CraftRecipe; error?: string }> {
  try {
    await assertAuthorizedTenantAdmin(tenantId);
    const recipe = await MarketOSRepository.getCraftRecipeById(tenantId, recipeId);

    if (!recipe) {
      return { success: false, error: "Receta no encontrada" };
    }

    const actor = await getCraftAuditActor();
    let productId = recipe.product_id;
    let syncedProduct: Product | undefined = undefined;

    // 1. Si ya tiene producto asociado, actualizamos precio y estado
    if (productId) {
      const updated = await MarketOSRepository.updateProduct({
        tenantId,
        productId,
        name: recipe.name,
        priceUsd: recipe.selling_price_base,
        costPrice: recipe.direct_cost_base,
        sku: recipe.sku || undefined,
        description: options?.description || recipe.notes || `Producto de ${recipe.technique}`,
        imageUrl: options?.imageUrl || undefined,
        isActive: true,
        actorId: actor.id,
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: actor.role,
      });

      if (updated) {
        syncedProduct = updated;
      }
    } else {
      // 2. Si no tiene producto, creamos uno nuevo en el catálogo
      let targetCategoryId = options?.categoryId;
      if (!targetCategoryId) {
        const categories = await MarketOSRepository.getCategories(tenantId);
        const matched = categories.find(
          (c) =>
            c.name.toLowerCase() === (recipe.category_name || recipe.technique).toLowerCase()
        );
        if (matched) {
          targetCategoryId = matched.id;
        } else if (categories.length > 0) {
          targetCategoryId = categories[0].id;
        } else {
          const newCat = await MarketOSRepository.createCategory(tenantId, {
            name: recipe.category_name || "Personalizados",
          });
          targetCategoryId = newCat.id;
        }
      }

      const created = await MarketOSRepository.createProduct({
        tenantId,
        name: recipe.name,
        categoryId: targetCategoryId,
        priceUsd: recipe.selling_price_base,
        costPrice: recipe.direct_cost_base,
        sku: recipe.sku || `REC-${recipe.id.slice(0, 6).toUpperCase()}`,
        description:
          options?.description ||
          recipe.notes ||
          `Producto personalizado elaborado con técnica de ${recipe.technique}.`,
        imageUrl: options?.imageUrl || undefined,
        initialStock: 25,
        actorId: actor.id,
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: actor.role,
      });

      if (created) {
        productId = created.id;
        syncedProduct = created;
      }
    }

    if (!productId) {
      return { success: false, error: "No se pudo sincronizar el producto en vitrina" };
    }

    // 3. Vincular recipe con el producto y marcar is_published = true
    const updatedRecipe = await MarketOSRepository.updateCraftRecipe({
      tenantId,
      recipeId,
      productId,
      isPublished: true,
    });

    invalidateProductsCache(tenantId);
    revalidatePath("/admin");
    revalidatePath(`/t/${tenantId}`);
    revalidatePath("/t/[tenant]", "page");

    return {
      success: true,
      product: syncedProduct,
      recipe: updatedRecipe || undefined,
    };
  } catch (error) {
    console.error("[craft-actions] publishRecipeToStorefrontAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al publicar receta en tienda",
    };
  }
}

export async function unpublishRecipeFromStorefrontAction(
  tenantId: string,
  recipeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertAuthorizedTenantAdmin(tenantId);
    const recipe = await MarketOSRepository.getCraftRecipeById(tenantId, recipeId);

    if (!recipe) {
      return { success: false, error: "Receta no encontrada" };
    }

    // 1. Desmarcar publicación en la receta
    await MarketOSRepository.updateCraftRecipe({
      tenantId,
      recipeId,
      isPublished: false,
    });

    // 2. Si tenía producto vinculado, desactivarlo de la vitrina para que no sea visible al público
    if (recipe.product_id) {
      const actor = await getCraftAuditActor();
      await MarketOSRepository.updateProduct({
        tenantId,
        productId: recipe.product_id,
        isActive: false,
        actorId: actor.id,
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: actor.role,
      });
    }

    invalidateProductsCache(tenantId);
    revalidatePath("/admin");
    revalidatePath(`/t/${tenantId}`);
    revalidatePath("/t/[tenant]", "page");

    return { success: true };
  } catch (error) {
    console.error("[craft-actions] unpublishRecipeFromStorefrontAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al retirar receta de tienda",
    };
  }
}

// =============================================================================
// 4. COTIZACIONES RÁPIDAS PARA WHATSAPP (craft_quotes)
// =============================================================================

export async function getCraftQuotesAction(
  tenantId: string,
  limit = 50
): Promise<{ success: boolean; data?: CraftQuote[]; error?: string }> {
  try {
    await assertAuthorizedTenantAdmin(tenantId);
    const quotes = await MarketOSRepository.getCraftQuotes(tenantId, limit);
    return { success: true, data: quotes };
  } catch (error) {
    console.error("[craft-actions] getCraftQuotesAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al obtener cotizaciones",
    };
  }
}

export async function createCraftQuoteAction(
  tenantId: string,
  input: Omit<CreateCraftQuoteInput, "tenantId">
): Promise<{ success: boolean; quote?: CraftQuote; error?: string }> {
  try {
    await assertAuthorizedTenantAdmin(tenantId);
    const quote = await MarketOSRepository.createCraftQuote({
      ...input,
      tenantId,
    });

    if (!quote) {
      return { success: false, error: "No se pudo registrar la cotización" };
    }

    revalidatePath("/admin");
    return { success: true, quote };
  } catch (error) {
    console.error("[craft-actions] createCraftQuoteAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al generar cotización",
    };
  }
}

export async function updateCraftQuoteStatusAction(
  tenantId: string,
  quoteId: string,
  status: CraftQuoteStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertAuthorizedTenantAdmin(tenantId);
    const ok = await MarketOSRepository.updateCraftQuoteStatus(tenantId, quoteId, status);

    if (!ok) {
      return { success: false, error: "No se pudo actualizar el estado de la cotización" };
    }

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("[craft-actions] updateCraftQuoteStatusAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al actualizar estado",
    };
  }
}

export async function convertCraftQuoteToOrderAction(
  tenantId: string,
  quoteId: string,
  orderOptions?: {
    deliveryType?: DeliveryType;
    deliveryAddress?: string;
    notes?: string;
  }
): Promise<{ success: boolean; order?: Order; error?: string }> {
  try {
    await assertAuthorizedTenantAdmin(tenantId);
    const quotes = await MarketOSRepository.getCraftQuotes(tenantId, 100);
    const quote = quotes.find((q) => q.id === quoteId);

    if (!quote) {
      return { success: false, error: "Cotización no encontrada" };
    }

    if (quote.status === "converted_to_order" && quote.converted_order_id) {
      return {
        success: false,
        error: `Esta cotización ya fue convertida previamente a la orden #${quote.converted_order_id}`,
      };
    }

    // Obtener sucursal válida del comercio
    const stores = await MarketOSRepository.getStores(tenantId);
    const storeId = stores[0]?.id || "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d";

    // Transformar los renglones de la cotización a items de orden
    const orderItems: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPriceUsd: number;
      is_tax_exempt?: boolean;
    }> = [];

    for (const it of quote.items) {
      let resolvedProductId: string | undefined = undefined;

      // Si tiene recipe_id, intentar extraer su product_id
      if (it.recipe_id) {
        const recipe = await MarketOSRepository.getCraftRecipeById(tenantId, it.recipe_id);
        if (recipe?.product_id) {
          resolvedProductId = recipe.product_id;
        }
      }

      // Si no existe producto en catálogo para este ítem personalizado,
      // buscamos o creamos un producto genérico de taller para asociarlo válidamente
      if (!resolvedProductId) {
        const products = await MarketOSRepository.getProducts(tenantId);
        const existingCustom = products.find(
          (p) => p.name.toLowerCase() === it.name.toLowerCase()
        );
        if (existingCustom) {
          resolvedProductId = existingCustom.id;
        } else {
          const categories = await MarketOSRepository.getCategories(tenantId);
          const defaultCatId = categories[0]?.id || "c1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d";
          const actor = await getCraftAuditActor();
          const createdCustom = await MarketOSRepository.createProduct({
            tenantId,
            name: it.name,
            categoryId: defaultCatId,
            priceUsd: it.unit_price_base,
            sku: `CRAFT-${Date.now().toString().slice(-6)}`,
            description: `Ítem cotizado personalizado: ${it.notes || "Taller"}`,
            initialStock: 100,
            actorId: actor.id,
            actorName: actor.name,
            actorEmail: actor.email,
            actorRole: actor.role,
          });
          resolvedProductId = createdCustom.id;
        }
      }

      orderItems.push({
        productId: resolvedProductId,
        productName: it.name,
        quantity: it.quantity,
        unitPriceUsd: it.unit_price_base,
        is_tax_exempt: false,
      });
    }

    const customNotes = [
      `Convertido desde Cotización #${quote.quote_number}`,
      quote.shipping_notes ? `Envíos: ${quote.shipping_notes}` : null,
      orderOptions?.notes,
    ]
      .filter(Boolean)
      .join(" | ");

    // Crear la orden oficial
    const order = await MarketOSRepository.createOrder({
      tenantId,
      storeId,
      customerName: quote.customer_name || "Cliente Taller",
      customerPhone: quote.customer_phone || "+58 412-0000000",
      deliveryType: orderOptions?.deliveryType || "PICKUP",
      deliveryAddress: orderOptions?.deliveryAddress || quote.shipping_notes || undefined,
      deliveryFeeUsd: quote.shipping_cost_base || 0,
      items: orderItems,
      notes: customNotes,
    });

    // Actualizar estado de la cotización y enlazar ID de orden
    await MarketOSRepository.updateCraftQuoteStatus(
      tenantId,
      quote.id,
      "converted_to_order",
      order.id
    );

    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    return { success: true, order };
  } catch (error) {
    console.error("[craft-actions] convertCraftQuoteToOrderAction error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al convertir cotización en orden",
    };
  }
}
