import type {
  DeliveryZone,
  CreateDeliveryZoneInput,
  UpdateDeliveryZoneInput,
  Driver,
  CreateDriverInput,
  UpdateDriverInput,
} from "@marketos/types";
import { state } from "../mock-data.ts";
import { getSupabase, generateUuid, isLiveDatabaseConfigured } from "./base.ts";
import { TenantRepository } from "./tenant.repository.ts";

export class DeliveryRepository {
  /**
   * Get Delivery Zones for Tenant
   */
  static async getDeliveryZones(
    tenantId: string,
    includeInactive = false
  ): Promise<DeliveryZone[]> {
    const supabase = getSupabase();
    if (supabase) {
      let query = supabase
        .from("delivery_zones")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("sort_order", { ascending: true });

      if (!includeInactive) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        return data as DeliveryZone[];
      }
    }

    if (isLiveDatabaseConfigured()) {
      return [];
    }

    return state.deliveryZones
      .filter((z) => z.tenant_id === tenantId && (includeInactive || z.is_active))
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  /**
   * Create a new delivery zone
   */
  static async createDeliveryZone(
    input: CreateDeliveryZoneInput
  ): Promise<DeliveryZone> {
    const supabase = getSupabase();
    const id = generateUuid();
    const now = new Date().toISOString();
    const sortOrder =
      input.sortOrder !== undefined
        ? input.sortOrder
        : state.deliveryZones.filter((z) => z.tenant_id === input.tenantId).length + 1;

    const newZone: DeliveryZone = {
      id,
      tenant_id: input.tenantId,
      name: input.name.trim(),
      price_usd: Math.max(0, Number(input.priceUsd)),
      estimated_time: input.estimatedTime?.trim() || "30-45 min",
      coverage_description: input.coverageDescription?.trim() || null,
      is_active: input.isActive !== undefined ? input.isActive : true,
      sort_order: sortOrder,
      created_at: now,
      updated_at: now,
    };

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("delivery_zones")
          .insert({
            id: newZone.id,
            tenant_id: newZone.tenant_id,
            name: newZone.name,
            price_usd: newZone.price_usd,
            estimated_time: newZone.estimated_time,
            coverage_description: newZone.coverage_description,
            is_active: newZone.is_active,
            sort_order: newZone.sort_order,
          })
          .select("*")
          .single();

        if (!error && data) {
          state.deliveryZones.push(data as DeliveryZone);
          return data as DeliveryZone;
        }
      } catch (e) {
        console.warn("[DeliveryRepository] createDeliveryZone fallback:", e);
      }
    }

    state.deliveryZones.push(newZone);
    return newZone;
  }

  /**
   * Update an existing delivery zone
   */
  static async updateDeliveryZone(
    input: UpdateDeliveryZoneInput
  ): Promise<DeliveryZone | null> {
    const supabase = getSupabase();
    const now = new Date().toISOString();

    const updates: any = { updated_at: now };
    if (input.name !== undefined) updates.name = input.name.trim();
    if (input.priceUsd !== undefined) updates.price_usd = Math.max(0, Number(input.priceUsd));
    if (input.estimatedTime !== undefined) updates.estimated_time = input.estimatedTime.trim();
    if (input.coverageDescription !== undefined)
      updates.coverage_description = input.coverageDescription ? input.coverageDescription.trim() : null;
    if (input.isActive !== undefined) updates.is_active = input.isActive;
    if (input.sortOrder !== undefined) updates.sort_order = input.sortOrder;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("delivery_zones")
          .update(updates)
          .eq("id", input.zoneId)
          .eq("tenant_id", input.tenantId)
          .select("*")
          .single();

        if (!error && data) {
          const idx = state.deliveryZones.findIndex((z) => z.id === input.zoneId);
          if (idx !== -1) {
            state.deliveryZones[idx] = data as DeliveryZone;
          }
          return data as DeliveryZone;
        }
      } catch (e) {
        console.warn("[DeliveryRepository] updateDeliveryZone fallback:", e);
      }
    }

    const idx = state.deliveryZones.findIndex(
      (z) => z.id === input.zoneId && z.tenant_id === input.tenantId
    );
    if (idx !== -1) {
      state.deliveryZones[idx] = {
        ...state.deliveryZones[idx],
        ...updates,
      };
      return state.deliveryZones[idx];
    }
    return null;
  }

  /**
   * Toggle delivery zone active status
   */
  static async toggleDeliveryZoneStatus(
    tenantId: string,
    zoneId: string,
    isActive: boolean
  ): Promise<boolean> {
    const supabase = getSupabase();
    const now = new Date().toISOString();

    if (supabase) {
      try {
        await supabase
          .from("delivery_zones")
          .update({ is_active: isActive, updated_at: now })
          .eq("id", zoneId)
          .eq("tenant_id", tenantId);
      } catch (e) {
        console.warn("[DeliveryRepository] toggleDeliveryZoneStatus fallback:", e);
      }
    }

    const zone = state.deliveryZones.find(
      (z) => z.id === zoneId && z.tenant_id === tenantId
    );
    if (zone) {
      zone.is_active = isActive;
      zone.updated_at = now;
      return true;
    }
    return false;
  }

  /**
   * Get Drivers for Tenant
   */
  static async getDrivers(
    tenantId: string,
    includeInactive = false
  ): Promise<Driver[]> {
    const supabase = getSupabase();
    if (supabase) {
      let query = supabase
        .from("drivers")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true });

      if (!includeInactive) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        return data as Driver[];
      }
    }

    if (isLiveDatabaseConfigured()) {
      return [];
    }

    return state.drivers.filter(
      (d) => d.tenant_id === tenantId && (includeInactive || d.is_active)
    );
  }

  /**
   * Create a new driver
   */
  static async createDriver(input: CreateDriverInput): Promise<Driver> {
    // 🔒 FEATURE FLAG: Drivers module is unlocked on Growth & Enterprise plans
    const limits = await TenantRepository.getTenantPlanLimits(input.tenantId);
    if (!limits.features.drivers) {
      throw new Error(
        `PLAN_FEATURE_LOCKED: El módulo de repartidores y motoristas dedicados requiere el plan Growth o Enterprise. Tu plan actual (${limits.plan.name}) no incluye esta funcionalidad.`
      );
    }

    const supabase = getSupabase();
    const id = generateUuid();
    const now = new Date().toISOString();

    const newDriver: Driver = {
      id,
      tenant_id: input.tenantId,
      store_id: input.storeId || null,
      name: input.name.trim(),
      phone: input.phone.trim(),
      vehicle_type: input.vehicleType,
      plate_number: input.plateNumber ? input.plateNumber.trim() : null,
      is_active: input.isActive !== undefined ? input.isActive : true,
      created_at: now,
      updated_at: now,
    };

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("drivers")
          .insert({
            id: newDriver.id,
            tenant_id: newDriver.tenant_id,
            store_id: newDriver.store_id,
            name: newDriver.name,
            phone: newDriver.phone,
            vehicle_type: newDriver.vehicle_type,
            plate_number: newDriver.plate_number,
            is_active: newDriver.is_active,
          })
          .select("*")
          .single();

        if (!error && data) {
          state.drivers.push(data as Driver);
          return data as Driver;
        }
      } catch (e) {
        console.warn("[Supabase] createDriver fallback:", e);
      }
    }

    state.drivers.push(newDriver);
    return newDriver;
  }

  /**
   * Soft delete (deactivate) or reactivate a delivery driver
   */
  static async toggleDriverStatus(
    tenantId: string,
    driverId: string,
    isActive: boolean
  ): Promise<boolean> {
    const supabase = getSupabase();
    const now = new Date().toISOString();

    if (supabase) {
      try {
        await supabase
          .from("drivers")
          .update({ is_active: isActive, updated_at: now })
          .eq("id", driverId)
          .eq("tenant_id", tenantId);
      } catch (e) {
        console.warn("[DeliveryRepository] toggleDriverStatus fallback:", e);
      }
    }

    const driver = state.drivers.find(
      (d) => d.id === driverId && d.tenant_id === tenantId
    );
    if (driver) {
      driver.is_active = isActive;
      driver.updated_at = now;
      return true;
    }
    return false;
  }

  /**
   * Update an existing driver
   */
  static async updateDriver(input: UpdateDriverInput): Promise<Driver | null> {
    const supabase = getSupabase();
    const now = new Date().toISOString();

    const updates: any = { updated_at: now };
    if (input.name !== undefined) updates.name = input.name.trim();
    if (input.phone !== undefined) updates.phone = input.phone.trim();
    if (input.vehicleType !== undefined) updates.vehicle_type = input.vehicleType;
    if (input.plateNumber !== undefined) updates.vehicle_plate = input.plateNumber?.trim() || null;
    if (input.isActive !== undefined) updates.is_active = input.isActive;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("drivers")
          .update(updates)
          .eq("id", input.driverId)
          .eq("tenant_id", input.tenantId)
          .select("*")
          .single();

        if (!error && data) {
          const idx = state.drivers.findIndex((d) => d.id === input.driverId);
          if (idx !== -1) {
            state.drivers[idx] = data as Driver;
          }
          return data as Driver;
        }
      } catch (e) {
        console.warn("[DeliveryRepository] updateDriver fallback:", e);
      }
    }

    const idx = state.drivers.findIndex(
      (d) => d.id === input.driverId && d.tenant_id === input.tenantId
    );
    if (idx !== -1) {
      state.drivers[idx] = {
        ...state.drivers[idx],
        ...updates,
      };
      return state.drivers[idx];
    }
    return null;
  }
}
