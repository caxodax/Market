import type {
  Store,
  Category,
  Product,
  CreateProductInput,
  UpdateProductInput,
  ProductBarcode,
  WarehouseLocation,
  InventoryMovement,
  AuditActor,
  AuditActionType,
} from "@marketos/types";
import { state } from "../mock-data.ts";
import { getSupabase, generateUuid, isUuid, isLiveDatabaseConfigured } from "./base.ts";
import { AuditRepository } from "./audit.repository.ts";
import { TenantRepository } from "./tenant.repository.ts";

export class CatalogRepository {

/**
   * Get Stores for Tenant
   */
  static async getStores(tenantId: string, includeInactive: boolean = false): Promise<Store[]> {
    const supabase = getSupabase();
    if (supabase) {
      let query = supabase.from("stores").select("*").eq("tenant_id", tenantId);
      if (!includeInactive) {
        query = query.eq("is_active", true);
      }
      const { data, error } = await query.order("created_at", { ascending: true });

      if (!error && Array.isArray(data)) {
        return data as Store[];
      }
    }

    const isPrimaryTenant = tenantId === "shop-market-ca" || tenantId === "shop-market";
    if (isLiveDatabaseConfigured() && !isPrimaryTenant) return [];
    return state.stores.filter(
      (s) => (s.tenant_id === tenantId || (isPrimaryTenant && s.tenant_id === "shop-market-ca")) && (includeInactive || s.is_active)
    );
  }

/**
   * Create new Store / Sucursal for Tenant
   */
  static async createStore(storeInput: {
    tenantId: string;
    name: string;
    code?: string;
    address?: string;
    phone?: string;
    isActive?: boolean;
  }): Promise<Store> {
    // 🔒 ENFORCE SAAS QUOTA: Maximum stores allowed for tenant's plan
    const limits = await TenantRepository.getTenantPlanLimits(storeInput.tenantId);
    if (!limits.canAddStore) {
      throw new Error(
        `PLAN_QUOTA_EXCEEDED: Has alcanzado el límite de ${limits.plan.max_stores} sucursal(es) de tu plan ${limits.plan.name} (${limits.usage.storesCount}/${limits.plan.max_stores}). Actualiza a un plan superior para registrar nuevas sucursales.`
      );
    }

    const supabase = getSupabase();
    const newStore: Store = {
      id: generateUuid(),
      tenant_id: storeInput.tenantId,
      name: storeInput.name,
      code: storeInput.code || `STR-${Math.floor(1000 + Math.random() * 9000)}`,
      address: storeInput.address || "",
      phone: storeInput.phone || null,
      is_active: storeInput.isActive !== undefined ? storeInput.isActive : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("stores")
          .insert(newStore)
          .select()
          .maybeSingle();

        if (!error && data) {
          state.stores.push(data as Store);
          return data as Store;
        }
      } catch (err) {
        console.warn("[MarketOS] createStore Supabase error:", err);
      }
    }

    state.stores.push(newStore);
    return newStore;
  }

/**
   * Update Store / Sucursal
   */
  static async updateStore(
    storeId: string,
    updates: Partial<Store>
  ): Promise<Store | null> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("stores")
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq("id", storeId)
          .select()
          .maybeSingle();

        if (!error && data) {
          const idx = state.stores.findIndex((s) => s.id === storeId);
          if (idx !== -1) state.stores[idx] = data as Store;
          return data as Store;
        }
      } catch (err) {
        console.warn("[MarketOS] updateStore Supabase error:", err);
      }
    }

    const st = state.stores.find((s) => s.id === storeId);
    if (st) {
      Object.assign(st, updates, { updated_at: new Date().toISOString() });
      return st;
    }
    return null;
  }

  /**
   * Get Categories for Tenant
   */
  static async getCategories(tenantId: string): Promise<Category[]> {
    const supabase = getSupabase();
    const isPrimaryTenant = tenantId === "shop-market-ca" || tenantId === "shop-market";
    const queryTenantId = isPrimaryTenant ? "shop-market-ca" : tenantId;

    if (supabase) {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("tenant_id", queryTenantId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        const existingIds = new Set(data.map((c: any) => c.id));
        const existingSlugs = new Set(data.map((c: any) => (c.slug || "").toLowerCase().trim()));
        const existingNames = new Set(data.map((c: any) => (c.name || "").toLowerCase().trim()));

        // In-memory fallback ONLY for runtime created items (e.g. during tests without DB insert permission)
        // Never include hardcoded mock seeds (starts with "cat-") when database categories exist.
        const inMemExtra = state.categories.filter((c) => {
          if (c.tenant_id !== tenantId && !(isPrimaryTenant && c.tenant_id === "shop-market-ca")) return false;
          if (!c.is_active) return false;
          if (c.id.startsWith("cat-")) return false;
          if (existingIds.has(c.id)) return false;
          if (existingSlugs.has((c.slug || "").toLowerCase().trim())) return false;
          if (existingNames.has((c.name || "").toLowerCase().trim())) return false;
          return true;
        });

        const combined = [...data, ...inMemExtra] as Category[];

        // Strict deduplication safeguard: ensure unique slug & name
        const seenKeys = new Set<string>();
        const uniqueCategories: Category[] = [];
        for (const cat of combined) {
          const key = (cat.slug || cat.name || "").toLowerCase().trim();
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            uniqueCategories.push(cat);
          }
        }
        return uniqueCategories;
      }
    }

    const fallbackList = state.categories
      .filter((c) => (c.tenant_id === tenantId || (isPrimaryTenant && c.tenant_id === "shop-market-ca")) && c.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);

    const seenKeys = new Set<string>();
    const uniqueFallback: Category[] = [];
    for (const cat of fallbackList) {
      const key = (cat.slug || cat.name || "").toLowerCase().trim();
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueFallback.push(cat);
      }
    }
    return uniqueFallback;
  }

  /**
   * Create a new Category for Tenant
   */
  static async createCategory(
    tenantId: string,
    data: { name: string; slug?: string; image_url?: string | null; sort_order?: number }
  ): Promise<Category> {
    const cleanName = data.name.trim();
    if (!cleanName) {
      throw new Error("El nombre de la categoría es requerido.");
    }

    const slug =
      data.slug ||
      cleanName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    const isPrimaryTenant = tenantId === "shop-market-ca" || tenantId === "shop-market";
    const queryTenantId = isPrimaryTenant ? "shop-market-ca" : tenantId;

    // Check if category already exists to avoid creating duplicates
    const currentCategories = await this.getCategories(tenantId);
    const existing = currentCategories.find(
      (c) =>
        c.name.trim().toLowerCase() === cleanName.toLowerCase() ||
        (c.slug && c.slug.toLowerCase().trim() === slug.toLowerCase().trim())
    );
    if (existing) {
      return existing;
    }

    const newId = generateUuid();
    const sortOrder =
      data.sort_order ??
      (currentCategories.length + 1);

    const newCategory: Category = {
      id: newId,
      tenant_id: queryTenantId,
      name: cleanName,
      slug: slug || `cat-${Date.now()}`,
      image_url: data.image_url || null,
      sort_order: sortOrder,
      is_active: true,
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: inserted, error } = await supabase
          .from("categories")
          .insert({
            id: newCategory.id,
            tenant_id: queryTenantId,
            name: newCategory.name,
            slug: newCategory.slug,
            image_url: newCategory.image_url,
            sort_order: newCategory.sort_order,
            is_active: true,
          })
          .select()
          .single();

        if (!error && inserted) {
          const already = state.categories.some((c) => c.id === inserted.id);
          if (!already) state.categories.push(inserted as Category);
          return inserted as Category;
        } else if (error) {
          if (error.code === "23505" || error.message?.includes("uq_tenant_category_slug")) {
            const { data: found } = await supabase
              .from("categories")
              .select("*")
              .eq("tenant_id", queryTenantId)
              .eq("slug", newCategory.slug)
              .maybeSingle();
            if (found) return found as Category;
          }
          console.warn("[MarketOS] createCategory Supabase warning:", error.message || error);
        }
      } catch (e) {
        console.warn("[MarketOS] createCategory exception:", e);
      }
    }

    const alreadyInMem = state.categories.some(
      (c) =>
        (c.tenant_id === queryTenantId || c.tenant_id === tenantId) &&
        (c.id === newCategory.id || c.slug === newCategory.slug || c.name.toLowerCase() === cleanName.toLowerCase())
    );
    if (!alreadyInMem) {
      state.categories.push(newCategory);
    }
    return newCategory;
  }

  /**
   * Update an existing Category
   */
  static async updateCategory(
    tenantId: string,
    categoryId: string,
    data: Partial<Pick<Category, "name" | "slug" | "image_url" | "sort_order" | "is_active">>
  ): Promise<Category | null> {
    const supabase = getSupabase();
    const isPrimaryTenant = tenantId === "shop-market-ca" || tenantId === "shop-market";
    const queryTenantId = isPrimaryTenant ? "shop-market-ca" : tenantId;

    if (supabase && isUuid(categoryId)) {
      try {
        const { data: updated, error } = await supabase
          .from("categories")
          .update(data)
          .eq("tenant_id", queryTenantId)
          .eq("id", categoryId)
          .select()
          .single();

        if (!error && updated) {
          const idx = state.categories.findIndex(
            (c) => (c.tenant_id === tenantId || (isPrimaryTenant && c.tenant_id === "shop-market-ca")) && c.id === categoryId
          );
          if (idx !== -1) {
            state.categories[idx] = { ...state.categories[idx], ...updated };
          }
          return updated as Category;
        }
      } catch (e) {
        console.warn("[MarketOS] updateCategory exception:", e);
      }
    }

    const idx = state.categories.findIndex(
      (c) => (c.tenant_id === tenantId || (isPrimaryTenant && c.tenant_id === "shop-market-ca")) && c.id === categoryId
    );
    if (idx !== -1) {
      state.categories[idx] = { ...state.categories[idx], ...data };
      return state.categories[idx];
    }
    return null;
  }

  /**
   * Delete or deactivate a Category
   */
  static async deleteCategory(tenantId: string, categoryId: string): Promise<boolean> {
    const supabase = getSupabase();
    const isPrimaryTenant = tenantId === "shop-market-ca" || tenantId === "shop-market";
    const queryTenantId = isPrimaryTenant ? "shop-market-ca" : tenantId;

    if (supabase && isUuid(categoryId)) {
      try {
        const { error } = await supabase
          .from("categories")
          .update({ is_active: false })
          .eq("tenant_id", queryTenantId)
          .eq("id", categoryId);

        if (error) {
          console.warn("[MarketOS] deleteCategory Supabase warning:", error.message || error);
        }
      } catch (e) {
        console.warn("[MarketOS] deleteCategory exception:", e);
      }
    }

    const idx = state.categories.findIndex(
      (c) => (c.tenant_id === tenantId || (isPrimaryTenant && c.tenant_id === "shop-market-ca")) && c.id === categoryId
    );
    if (idx !== -1) {
      state.categories[idx].is_active = false;
    }
    return true;
  }

/**
   * Get Products for Tenant with optional category & search filter
   */
  static async getProducts(
    tenantId: string,
    categoryId?: string,
    query?: string,
    limit?: number,
    offset?: number
  ): Promise<(Product & { stock: number })[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        let q = supabase
          .from("products")
          .select("*, inventory(quantity)")
          .eq("tenant_id", tenantId)
          .eq("is_active", true);

        if (categoryId) {
          q = q.eq("category_id", categoryId);
        }

        if (query) {
          q = q.ilike("name", `%${query}%`);
        }

        if (limit && limit > 0) {
          if (offset && offset > 0) {
            q = q.range(offset, offset + limit - 1);
          } else {
            q = q.limit(limit);
          }
        }

        let { data, error } = await q;

        // If join with inventory fails, fallback to simple products select
        if (error) {
          console.warn("[MarketOS] getProducts join error, attempting simple select:", error.message || error);
          let simpleQ = supabase
            .from("products")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("is_active", true);

          if (categoryId) simpleQ = simpleQ.eq("category_id", categoryId);
          if (query) simpleQ = simpleQ.ilike("name", `%${query}%`);
          if (limit && limit > 0) {
            simpleQ = offset && offset > 0 ? simpleQ.range(offset, offset + limit - 1) : simpleQ.limit(limit);
          }
          const retryRes = await simpleQ;
          if (!retryRes.error && Array.isArray(retryRes.data) && retryRes.data.length > 0) {
            data = retryRes.data;
            error = null;
          }
        }

        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map((item: any) => {
            const totalStock = Array.isArray(item.inventory)
              ? item.inventory.reduce((sum: number, inv: any) => sum + (inv.quantity || 0), 0)
              : 20;

            return {
              id: item.id,
              tenant_id: item.tenant_id,
              category_id: item.category_id,
              name: item.name,
              slug: item.slug,
              description: item.description,
              sku: item.sku,
              barcode: item.barcode,
              image_url: item.image_url,
              price_usd: Number(item.price_usd),
              is_active: item.is_active,
              stock: totalStock,
              created_at: item.created_at,
              updated_at: item.updated_at,
            };
          });
        }

        if (error) {
          console.warn("[MarketOS] getProducts Supabase warning:", error);
        }
      } catch (e) {
        console.warn("[MarketOS] getProducts exception:", e);
      }
    }

    // High availability fallback: If DB query timed out or had a transient glitch,
    // retrieve in-memory state so storefront catalog never flashes empty.
    const filtered = state.products.filter((p) => {
      const matchesTenant =
        p.tenant_id === tenantId ||
        (tenantId === "shop-market" && p.tenant_id === "shop-market-ca") ||
        (tenantId === "shop-market-ca" && p.tenant_id === "shop-market");
      if (!matchesTenant || !p.is_active) return false;
      if (categoryId && p.category_id !== categoryId) return false;
      if (query && !p.name.toLowerCase().includes(query.toLowerCase()))
        return false;
      return true;
    });

    const start = offset && offset > 0 ? offset : 0;
    return limit && limit > 0 ? filtered.slice(start, start + limit) : (start > 0 ? filtered.slice(start) : filtered);
  }

/**
   * Create a new product with stock and Cloudflare R2 image
   */
  static async createProduct(
    input: CreateProductInput
  ): Promise<Product & { stock: number }> {
    // 🔒 ENFORCE SAAS QUOTA: Maximum products allowed for tenant's plan
    const limits = await TenantRepository.getTenantPlanLimits(input.tenantId);
    if (!limits.canAddProduct) {
      throw new Error(
        `PLAN_QUOTA_EXCEEDED: Has alcanzado el límite de ${limits.plan.max_products} productos de tu plan ${limits.plan.name} (${limits.usage.productsCount}/${limits.plan.max_products}). Actualiza a un plan superior para seguir agregando productos.`
      );
    }

    const supabase = getSupabase();
    const slug = `${input.name.toLowerCase().trim().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString().slice(-4)}`;
    
    // Resolve store ID for inventory
    const tenantStores = supabase ? await this.getStores(input.tenantId, true) : [];
    const storeId =
      input.storeId ||
      tenantStores[0]?.id ||
      state.stores.find((s) => s.tenant_id === input.tenantId)?.id ||
      "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d";
    const initialStock = input.initialStock !== undefined ? input.initialStock : 20;
    const generatedId = generateUuid();

    let createdProduct: Product & { stock: number } = {
      id: generatedId,
      tenant_id: input.tenantId,
      category_id: input.categoryId,
      name: input.name,
      slug,
      description: input.description || null,
      sku: input.sku || null,
      barcode: input.barcode || null,
      image_url: input.imageUrl || null,
      price_usd: input.priceUsd,
      is_active: true,
      is_tax_exempt: Boolean(input.isTaxExempt),
      stock: initialStock,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (supabase) {
      try {
        const validCategoryUuid = isUuid(input.categoryId) ? input.categoryId : null;

        if (validCategoryUuid) {
          const insertPayload: Record<string, unknown> = {
            id: generatedId,
            tenant_id: input.tenantId,
            category_id: validCategoryUuid,
            name: input.name,
            slug,
            description: input.description || null,
            sku: input.sku || null,
            barcode: input.barcode || null,
            image_url: input.imageUrl || null,
            price_usd: input.priceUsd,
            is_active: true,
          };

          const { data: prodData, error } = await supabase
            .from("products")
            .insert(insertPayload)
            .select("id")
            .single();

          if (!error && prodData) {
            createdProduct.id = prodData.id;

            // Insert store inventory
            if (storeId && isUuid(storeId)) {
              await supabase.from("inventory").insert({
                tenant_id: input.tenantId,
                store_id: storeId,
                product_id: prodData.id,
                quantity: initialStock,
                min_quantity: 5,
              });

              // Insert inventory movement
              await supabase.from("inventory_movements").insert({
                tenant_id: input.tenantId,
                store_id: storeId,
                product_id: prodData.id,
                quantity_change: initialStock,
                previous_quantity: 0,
                new_quantity: initialStock,
                reason: "RESTOCK",
              });
            }
          } else if (error) {
            console.warn("[Supabase] Create product warning:", error.message || error);
          }
        } else {
          console.warn("[MarketOS] Skipping Supabase product insert because categoryId is not a UUID:", input.categoryId);
        }
      } catch (e) {
        console.warn("[Supabase] Create product exception:", e);
      }
    }

    state.products.unshift(createdProduct);

    await AuditRepository.recordAuditLog({
      tenantId: input.tenantId,
      actorId: input.actorId,
      actorName: input.actorName,
      actorEmail: input.actorEmail,
      actorRole: input.actorRole,
      action: "PRODUCT_CREATED",
      entity: "products",
      entityId: createdProduct.id,
      newData: {
        name: createdProduct.name,
        price_usd: createdProduct.price_usd,
        stock: initialStock,
        image_url: createdProduct.image_url,
      },
    });

    return createdProduct;
  }

/**
   * Update an existing product
   */
  static async updateProduct(
    input: UpdateProductInput
  ): Promise<(Product & { stock: number }) | null> {
    const supabase = getSupabase();
    const tenantStores = supabase ? await this.getStores(input.tenantId, true) : [];
    const storeId =
      input.storeId ||
      tenantStores[0]?.id ||
      state.stores.find((s) => s.tenant_id === input.tenantId)?.id ||
      "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d";

    let updatedFromDb: (Product & { stock: number }) | null = null;
    let oldPriceUsd: number | undefined = undefined;
    let oldStock: number | undefined = undefined;

    if (supabase && isUuid(input.productId)) {
      try {
        const updatePayload: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (input.name !== undefined) updatePayload.name = input.name;
        if (input.categoryId !== undefined && isUuid(input.categoryId)) {
          updatePayload.category_id = input.categoryId;
        }
        if (input.description !== undefined) updatePayload.description = input.description;
        if (input.priceUsd !== undefined) updatePayload.price_usd = input.priceUsd;
        if (input.sku !== undefined) updatePayload.sku = input.sku;
        if (input.barcode !== undefined) updatePayload.barcode = input.barcode;
        if (input.imageUrl !== undefined) updatePayload.image_url = input.imageUrl;
        if (input.isActive !== undefined) updatePayload.is_active = input.isActive;

        // Fetch current product to compare old values for audit
        const { data: currentProd } = await supabase
          .from("products")
          .select("*, inventory(quantity)")
          .eq("id", input.productId)
          .eq("tenant_id", input.tenantId)
          .maybeSingle();

        if (currentProd) {
          oldPriceUsd = Number(currentProd.price_usd);
          oldStock = Array.isArray(currentProd.inventory)
            ? currentProd.inventory.reduce((sum: number, inv: any) => sum + (inv.quantity || 0), 0)
            : 20;
        }

        const { data: updatedData, error: updateErr } = await supabase
          .from("products")
          .update(updatePayload)
          .eq("id", input.productId)
          .eq("tenant_id", input.tenantId)
          .select("*, inventory(quantity)")
          .maybeSingle();

        if (updateErr) {
          console.warn("[Supabase] Update product warning:", updateErr.message || updateErr);
        }

        if (input.stock !== undefined && storeId && isUuid(storeId)) {
          const { data: inv } = await supabase
            .from("inventory")
            .select("id, quantity")
            .eq("store_id", storeId)
            .eq("product_id", input.productId)
            .maybeSingle();

          if (inv) {
            await supabase
              .from("inventory")
              .update({ quantity: input.stock, updated_at: new Date().toISOString() })
              .eq("id", inv.id);

            await supabase.from("inventory_movements").insert({
              tenant_id: input.tenantId,
              store_id: storeId,
              product_id: input.productId,
              quantity_change: input.stock - inv.quantity,
              previous_quantity: inv.quantity,
              new_quantity: input.stock,
              reason: "ADJUSTMENT",
            });
          } else {
            await supabase
              .from("inventory")
              .upsert(
                {
                  tenant_id: input.tenantId,
                  store_id: storeId,
                  product_id: input.productId,
                  quantity: input.stock,
                  min_quantity: 5,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "store_id, product_id" }
              );

            await supabase.from("inventory_movements").insert({
              tenant_id: input.tenantId,
              store_id: storeId,
              product_id: input.productId,
              quantity_change: input.stock,
              previous_quantity: 0,
              new_quantity: input.stock,
              reason: "ADJUSTMENT",
            });
          }
        }

        if (updatedData) {
          const totalStock = input.stock !== undefined
            ? input.stock
            : Array.isArray(updatedData.inventory)
            ? updatedData.inventory.reduce((sum: number, inv: any) => sum + (inv.quantity || 0), 0)
            : (oldStock ?? 20);

          updatedFromDb = {
            id: updatedData.id,
            tenant_id: updatedData.tenant_id,
            category_id: updatedData.category_id,
            name: updatedData.name,
            slug: updatedData.slug,
            description: updatedData.description,
            sku: updatedData.sku,
            barcode: updatedData.barcode,
            image_url: updatedData.image_url,
            price_usd: Number(updatedData.price_usd),
            is_active: updatedData.is_active,
            is_tax_exempt: Boolean(input.isTaxExempt),
            stock: totalStock,
            created_at: updatedData.created_at,
            updated_at: updatedData.updated_at,
          };
        }
      } catch (e) {
        console.warn("[Supabase] Update product exception:", e);
      }
    }

    let prod = state.products.find(
      (p) => p.id === input.productId && p.tenant_id === input.tenantId
    );
    if (prod) {
      const oldData = { ...prod };
      if (oldPriceUsd === undefined) oldPriceUsd = oldData.price_usd;
      if (oldStock === undefined) oldStock = oldData.stock;

      if (input.name !== undefined) prod.name = input.name;
      if (input.categoryId !== undefined) prod.category_id = input.categoryId;
      if (input.description !== undefined) prod.description = input.description;
      if (input.priceUsd !== undefined) prod.price_usd = input.priceUsd;
      if (input.sku !== undefined) prod.sku = input.sku;
      if (input.barcode !== undefined) prod.barcode = input.barcode;
      if (input.imageUrl !== undefined) prod.image_url = input.imageUrl;
      if (input.isActive !== undefined) prod.is_active = input.isActive;
      if (input.isTaxExempt !== undefined) prod.is_tax_exempt = input.isTaxExempt;
      if (input.stock !== undefined) prod.stock = input.stock;
      prod.updated_at = new Date().toISOString();
    } else if (!updatedFromDb) {
      // Resilient fallback: product was fetched from DB but DB update was skipped or failed
      const newInMem: Product & { stock: number } = {
        id: input.productId,
        tenant_id: input.tenantId,
        category_id: input.categoryId || "c1111111-1111-1111-1111-111111111111",
        name: input.name || "Producto Actualizado",
        slug: (input.name || "producto").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        description: input.description || null,
        sku: input.sku || null,
        barcode: input.barcode || null,
        image_url: input.imageUrl || null,
        price_usd: input.priceUsd || 0,
        is_active: input.isActive ?? true,
        stock: input.stock ?? 20,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      state.products.push(newInMem);
      prod = newInMem;
    }

    const finalProduct = updatedFromDb || prod;
    if (!finalProduct) {
      return null;
    }

    // Sync in-memory state if finalProduct came from DB
    if (updatedFromDb) {
      const existingIdx = state.products.findIndex(
        (p) => p.id === input.productId && p.tenant_id === input.tenantId
      );
      if (existingIdx >= 0) {
        state.products[existingIdx] = { ...state.products[existingIdx], ...updatedFromDb };
      } else {
        state.products.unshift(updatedFromDb);
      }
    }

    // Check if price changed -> record surgical PRICE_CHANGED audit event
    if (
      input.priceUsd !== undefined &&
      oldPriceUsd !== undefined &&
      Number(input.priceUsd) !== Number(oldPriceUsd)
    ) {
      const oP = Number(oldPriceUsd);
      const nP = Number(input.priceUsd);
      const diff = Number((nP - oP).toFixed(2));
      const pct = oP > 0 ? Number(((diff / oP) * 100).toFixed(1)) : 0;

      await AuditRepository.recordAuditLog({
        tenantId: input.tenantId,
        actorId: input.actorId,
        actorName: input.actorName,
        actorEmail: input.actorEmail,
        actorRole: input.actorRole,
        action: "PRICE_CHANGED",
        entity: "products",
        entityId: input.productId,
        oldData: {
          price_usd: oP,
          price_formatted: `$${oP.toFixed(2)}`,
          name: finalProduct.name,
        },
        newData: {
          price_usd: nP,
          price_formatted: `$${nP.toFixed(2)}`,
          diff_usd: diff,
          percentage_change: pct,
          name: finalProduct.name,
        },
      });
    }

    await AuditRepository.recordAuditLog({
      tenantId: input.tenantId,
      actorId: input.actorId,
      actorName: input.actorName,
      actorEmail: input.actorEmail,
      actorRole: input.actorRole,
      action: "PRODUCT_UPDATED",
      entity: "products",
      entityId: input.productId,
      oldData: { price_usd: oldPriceUsd, stock: oldStock },
      newData: { price_usd: finalProduct.price_usd, stock: finalProduct.stock, name: finalProduct.name },
    });

    return finalProduct;
  }

/**
   * Delete / Deactivate a product
   */
  static async deleteProduct(
    tenantId: string,
    productId: string,
    actor?: AuditActor | null
  ): Promise<boolean> {
    const supabase = getSupabase();
    let deletedSuccessfully = false;
    let deletedProductName = "Producto";

    if (supabase && isUuid(productId)) {
      try {
        const { data, error } = await supabase
          .from("products")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("id", productId)
          .eq("tenant_id", tenantId)
          .select("name")
          .maybeSingle();

        if (!error && data) {
          deletedSuccessfully = true;
          deletedProductName = data.name;
        } else if (error) {
          console.warn("[Supabase] Delete product warning:", error.message || error);
        }
      } catch (e) {
        console.warn("[Supabase] Delete product exception:", e);
      }
    }

    const prod = state.products.find(
      (p) => p.id === productId && p.tenant_id === tenantId
    );
    if (prod) {
      prod.is_active = false;
      prod.updated_at = new Date().toISOString();
      deletedSuccessfully = true;
      deletedProductName = prod.name;
    }

    if (deletedSuccessfully) {
      await AuditRepository.recordAuditLog({
        tenantId,
        actorId: actor?.id,
        actorName: actor?.name,
        actorEmail: actor?.email,
        actorRole: actor?.role,
        action: "PRODUCT_DELETED",
        entity: "products",
        entityId: productId,
        newData: { is_active: false, name: deletedProductName },
      });
      return true;
    }

    return false;
  }

/**
   * Adjust product stock in Supabase inventory & record inventory movement
   */
  static async adjustStock(
    tenantId: string,
    productId: string,
    delta: number,
    storeId?: string,
    actor?: AuditActor | string | null
  ): Promise<number> {
    const actorObj: AuditActor =
      typeof actor === "string"
        ? { id: actor, name: "Admin Operativo", email: null, role: "ADMIN" }
        : actor || { id: null, name: "Admin Operativo", email: null, role: "ADMIN" };

    const targetStoreId =
      storeId || state.stores.find((s) => s.tenant_id === tenantId)?.id;
    const supabase = getSupabase();

    if (supabase && targetStoreId && isUuid(targetStoreId) && isUuid(productId)) {
      try {
        const { data: inv } = await supabase
          .from("inventory")
          .select("id, quantity")
          .eq("store_id", targetStoreId)
          .eq("product_id", productId)
          .maybeSingle();

        if (inv) {
          const newQty = Math.max(0, inv.quantity + delta);
          await supabase
            .from("inventory")
            .update({ quantity: newQty, updated_at: new Date().toISOString() })
            .eq("id", inv.id);

          await supabase.from("inventory_movements").insert({
            tenant_id: tenantId,
            store_id: targetStoreId,
            product_id: productId,
            quantity_change: delta,
            previous_quantity: inv.quantity,
            new_quantity: newQty,
            reason: delta > 0 ? "RESTOCK" : "ADJUSTMENT",
          });

          await AuditRepository.recordAuditLog({
            tenantId,
            actorId: actorObj.id,
            actorName: actorObj.name,
            actorEmail: actorObj.email,
            actorRole: actorObj.role,
            action: "STOCK_ADJUSTED",
            entity: "inventory",
            entityId: productId,
            oldData: { quantity: inv.quantity },
            newData: { quantity: newQty, delta },
          });

          return newQty;
        } else {
          const memProd = state.products.find((p) => p.id === productId);
          const initialStock = memProd?.stock !== undefined ? memProd.stock : 20;
          const newQty = Math.max(0, initialStock + delta);

          await supabase
            .from("inventory")
            .upsert(
              {
                tenant_id: tenantId,
                store_id: targetStoreId,
                product_id: productId,
                quantity: newQty,
                min_quantity: 5,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "store_id, product_id" }
            );

          await supabase.from("inventory_movements").insert({
            tenant_id: tenantId,
            store_id: targetStoreId,
            product_id: productId,
            quantity_change: delta,
            previous_quantity: initialStock,
            new_quantity: newQty,
            reason: delta > 0 ? "RESTOCK" : "ADJUSTMENT",
          });

          await AuditRepository.recordAuditLog({
            tenantId,
            actorId: actorObj.id,
            actorName: actorObj.name,
            actorEmail: actorObj.email,
            actorRole: actorObj.role,
            action: "STOCK_ADJUSTED",
            entity: "inventory",
            entityId: productId,
            oldData: { quantity: initialStock },
            newData: { quantity: newQty, delta },
          });

          return newQty;
        }
      } catch (e) {
        console.warn("[MarketOS] Adjust stock in Supabase error:", e);
      }
    }

    const prod = state.products.find(
      (p) => p.id === productId && p.tenant_id === tenantId
    );
    if (prod) {
      const oldStock = prod.stock;
      prod.stock = Math.max(0, prod.stock + delta);

      await AuditRepository.recordAuditLog({
        tenantId,
        actorId: actorObj.id,
        actorName: actorObj.name,
        actorEmail: actorObj.email,
        actorRole: actorObj.role,
        action: "STOCK_ADJUSTED",
        entity: "inventory",
        entityId: productId,
        oldData: { quantity: oldStock },
        newData: { quantity: prod.stock, delta },
      });

      return prod.stock;
    }
    return 0;
  }

static async getProductBarcodes(productId: string): Promise<ProductBarcode[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("product_barcodes")
          .select("*")
          .eq("product_id", productId)
          .order("created_at", { ascending: true });

        if (!error && data) {
          return data as ProductBarcode[];
        }
      } catch (e) {
        console.warn("[MarketOS] getProductBarcodes error:", e);
      }
    }
    return [];
  }

static async upsertProductBarcode(
    input: Omit<ProductBarcode, "id" | "created_at">
  ): Promise<ProductBarcode | null> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("product_barcodes")
          .upsert(
            {
              tenant_id: input.tenant_id,
              product_id: input.product_id,
              barcode: input.barcode,
              pack_name: input.pack_name,
              units_per_pack: input.units_per_pack,
              price_usd: input.price_usd,
              is_primary: input.is_primary,
            },
            { onConflict: "tenant_id,barcode" }
          )
          .select("*")
          .single();

        if (!error && data) {
          return data as ProductBarcode;
        }
      } catch (e) {
        console.warn("[MarketOS] upsertProductBarcode error:", e);
      }
    }
    return null;
  }

static async deleteProductBarcode(id: string): Promise<boolean> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase
          .from("product_barcodes")
          .delete()
          .eq("id", id);
        return !error;
      } catch (e) {
        console.warn("[MarketOS] deleteProductBarcode error:", e);
      }
    }
    return false;
  }

static async findProductByBarcode(
    tenantId: string,
    rawBarcode: string
  ): Promise<{ product: Product; barcodeRecord?: ProductBarcode; unitsPerPack: number; priceUsd: number } | null> {
    const clean = rawBarcode.trim();
    if (!clean) return null;
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      // 1. Try secondary packaging barcodes table first
      const { data: packBarcode } = await supabase
        .from("product_barcodes")
        .select("*, products(*)")
        .eq("tenant_id", tenantId)
        .eq("barcode", clean)
        .maybeSingle();

      if (packBarcode && packBarcode.products) {
        const p = packBarcode.products as Product;
        const units = packBarcode.units_per_pack || 1;
        const finalPrice =
          packBarcode.price_usd !== null && packBarcode.price_usd !== undefined
            ? Number(packBarcode.price_usd)
            : Number(p.price_usd) * units;

        return {
          product: p,
          barcodeRecord: packBarcode as ProductBarcode,
          unitsPerPack: units,
          priceUsd: finalPrice,
        };
      }

      // 2. Try primary products table barcode
      const { data: directProduct } = await supabase
        .from("products")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("barcode", clean)
        .maybeSingle();

      if (directProduct) {
        return {
          product: directProduct as Product,
          unitsPerPack: 1,
          priceUsd: Number(directProduct.price_usd),
        };
      }

      // 3. Fallback for GS1 Scale Barcode (prefixes 20-29): e.g. 2001452...
      if (clean.length === 13 && clean.startsWith("2")) {
        const itemCode = clean.slice(2, 7);
        // Look up product by SKU or external_product_id or trailing code
        const { data: scaleProd } = await supabase
          .from("products")
          .select("*")
          .eq("tenant_id", tenantId)
          .or(`sku.eq.${itemCode},barcode.ilike.%${itemCode}%,external_product_id.eq.${itemCode}`)
          .maybeSingle();

        if (scaleProd) {
          const isPriceMode = clean.startsWith("23") || clean.startsWith("24");
          const payloadNum = parseInt(clean.slice(7, 12), 10);
          const computedPrice = isPriceMode
            ? payloadNum / 100
            : Number(scaleProd.price_usd) * (payloadNum / 1000);

          return {
            product: scaleProd as Product,
            unitsPerPack: 1,
            priceUsd: computedPrice,
          };
        }
      }
    } catch (e) {
      console.warn("[MarketOS] findProductByBarcode error:", e);
    }

    return null;
  }

static async updateInventoryLocation(
    storeId: string,
    productId: string,
    location: WarehouseLocation
  ): Promise<boolean> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase
          .from("inventory")
          .update({
            aisle: location.aisle || "01",
            shelf: location.shelf || "A",
            bin: location.bin || "01",
          })
          .eq("store_id", storeId)
          .eq("product_id", productId);

        return !error;
      } catch (e) {
        console.warn("[MarketOS] updateInventoryLocation error:", e);
      }
    }
    return false;
  }
}
