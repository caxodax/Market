import type {
  AuditLog,
  RecordAuditLogInput,
  AuditLogFilters,
} from "@marketos/types";
import { state } from "../mock-data.ts";
import { getSupabase } from "./base.ts";

function isUuid(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

export class AuditRepository {
  /**
   * Record Audit Log in Supabase & memory state
   */
  static async recordAuditLog(input: RecordAuditLogInput): Promise<AuditLog> {
    const tenantName =
      input.tenantName ||
      state.tenants.find((t) => t.id === input.tenantId)?.name ||
      (input.tenantId === "platform" ? "Plataforma Central" : undefined);

    const actorDetails = {
      id: input.actorId || null,
      name: input.actorName || "Admin Operativo",
      email: input.actorEmail || null,
      role: input.actorRole || "OPERATOR",
    };

    const enrichedNewData: Record<string, unknown> = {
      ...(input.newData || {}),
      _actor: actorDetails,
      ...(tenantName ? { _tenant_name: tenantName } : {}),
    };

    const auditLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tenant_id: input.tenantId,
      tenant_name: tenantName || null,
      actor_id: input.actorId || null,
      actor_name: input.actorName || "Admin Operativo",
      actor_email: input.actorEmail || null,
      actor_role: input.actorRole || "OPERATOR",
      action: input.action,
      entity: input.entity,
      entity_id: input.entityId,
      old_data: input.oldData || null,
      new_data: enrichedNewData,
      created_at: new Date().toISOString(),
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        const actorUuid = input.actorId && isUuid(input.actorId) ? input.actorId : null;
        const insertPayload: Record<string, unknown> = {
          tenant_id: auditLog.tenant_id,
          action: auditLog.action,
          entity: auditLog.entity,
          entity_id: auditLog.entity_id,
          old_data: auditLog.old_data,
          new_data: enrichedNewData,
          actor_id: actorUuid,
        };
        if (input.actorName) insertPayload.actor_name = input.actorName;
        if (input.actorEmail) insertPayload.actor_email = input.actorEmail;
        if (input.actorRole) insertPayload.actor_role = input.actorRole;
        if (tenantName) insertPayload.tenant_name = tenantName;

        const { error: insertErr } = await supabase.from("audit_logs").insert(insertPayload);
        if (insertErr) {
          // Fallback to base columns if schema hasn't reloaded
          await supabase.from("audit_logs").insert({
            tenant_id: auditLog.tenant_id,
            action: auditLog.action,
            entity: auditLog.entity,
            entity_id: auditLog.entity_id,
            old_data: auditLog.old_data,
            new_data: enrichedNewData,
            actor_id: actorUuid,
          });
        }
      } catch (e) {
        console.warn("[MarketOS] Error recording audit log in Supabase:", e);
      }
    }

    state.auditLogs.unshift(auditLog);
    return auditLog;
  }

  /**
   * Get Audit Logs for Tenant Admin
   */
  static async getAuditLogs(tenantId: string, limit = 50): Promise<AuditLog[]> {
    return this.getGlobalAuditLogs({ tenantId, limit });
  }

  /**
   * Get Global Audit Logs across all tenants (Super Admin) or with filters
   */
  static async getGlobalAuditLogs(filters?: AuditLogFilters): Promise<AuditLog[]> {
    const limit = filters?.limit || 100;
    const supabase = getSupabase();

    const tenantMap = new Map<string, string>();
    state.tenants.forEach((t) => tenantMap.set(t.id, t.name));

    if (supabase) {
      try {
        let query = supabase
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (filters?.tenantId && filters.tenantId !== "ALL") {
          query = query.eq("tenant_id", filters.tenantId);
        }
        if (filters?.action && filters.action !== "ALL") {
          query = query.eq("action", filters.action);
        }
        if (filters?.actorId) {
          query = query.eq("actor_id", filters.actorId);
        }
        if (filters?.startDate) {
          query = query.gte("created_at", filters.startDate);
        }
        if (filters?.endDate) {
          query = query.lte("created_at", filters.endDate);
        }

        const { data, error } = await query;

        // Also fetch physical stock movements from inventory_movements
        let invData: any[] = [];
        try {
          let invQuery = supabase
            .from("inventory_movements")
            .select("*, products(name)")
            .order("created_at", { ascending: false })
            .limit(limit);

          if (filters?.tenantId && filters.tenantId !== "ALL") {
            invQuery = invQuery.eq("tenant_id", filters.tenantId);
          }
          if (filters?.startDate) {
            invQuery = invQuery.gte("created_at", filters.startDate);
          }
          if (filters?.endDate) {
            invQuery = invQuery.lte("created_at", filters.endDate);
          }

          const { data: idata, error: ierr } = await invQuery;
          if (!ierr && idata) {
            invData = idata;
          }
        } catch (invErr) {
          console.warn("[MarketOS] inventory_movements fetch warning:", invErr);
        }

        const mappedInv: AuditLog[] = invData.map((im: any) => {
          const prodName =
            im.products?.name ||
            state.products.find((p) => p.id === im.product_id)?.name ||
            "Producto";
          const reasonLabel =
            im.reason === "SALE"
              ? "VENTA"
              : im.reason === "CANCELLATION"
              ? "CANCELACIÓN"
              : im.reason === "RESTOCK"
              ? "REABASTECIMIENTO"
              : im.reason || "AJUSTE";

          return {
            id: `inv-${im.id}`,
            tenant_id: im.tenant_id,
            tenant_name: tenantMap.get(im.tenant_id) || "Tienda",
            actor_id: im.created_by || null,
            actor_name: im.reason === "SALE" ? "Venta en Línea" : "Sistema de Inventario",
            actor_email: null,
            actor_role: "SYSTEM",
            action: "STOCK_ADJUSTED",
            entity: "inventory",
            entity_id: im.product_id,
            old_data: {
              product_id: im.product_id,
              name: prodName,
              stock_quantity: im.previous_quantity,
            },
            new_data: {
              product_id: im.product_id,
              name: prodName,
              delta: im.quantity_change,
              quantity: im.new_quantity,
              reason: reasonLabel,
              note:
                im.reason === "SALE"
                  ? "Deducción automática por venta de comercio"
                  : im.reason === "CANCELLATION"
                  ? "Reintegro por orden cancelada"
                  : undefined,
            },
            created_at: im.created_at,
          };
        });

        const mappedAudit: AuditLog[] = (!error && data)
          ? data.map((d: any) => {
              const actorFromMeta =
                (d.new_data && typeof d.new_data === "object" && d.new_data._actor) || {};
              const tName =
                d.tenant_name ||
                (d.new_data && d.new_data._tenant_name) ||
                tenantMap.get(d.tenant_id) ||
                (d.tenant_id === "platform" ? "Plataforma Central" : "Tienda");

              return {
                id: d.id,
                tenant_id: d.tenant_id,
                tenant_name: tName,
                actor_id: d.actor_id || actorFromMeta.id || null,
                actor_name: d.actor_name || actorFromMeta.name || "Admin Operativo",
                actor_email: d.actor_email || actorFromMeta.email || null,
                actor_role: d.actor_role || actorFromMeta.role || null,
                action: d.action,
                entity: d.entity,
                entity_id: d.entity_id,
                old_data: d.old_data,
                new_data: d.new_data,
                created_at: d.created_at,
              };
            })
          : [];

        // Deduplicate: if an entry for the exact movement exists in audit_logs, don't duplicate
        const existingAuditKeys = new Set(
          mappedAudit
            .filter((a) => a.action === "STOCK_ADJUSTED")
            .map((a) => `${a.entity_id}_${a.new_data?.delta}_${a.created_at?.slice(0, 16)}`)
        );
        const filteredInv = mappedInv.filter(
          (im) => !existingAuditKeys.has(`${im.entity_id}_${im.new_data?.delta}_${im.created_at?.slice(0, 16)}`)
        );

        let combined = [...mappedAudit, ...filteredInv].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        if (filters?.action && filters.action !== "ALL") {
          combined = combined.filter((l) => l.action === filters.action);
        }

        if (filters?.search && filters.search.trim()) {
          const term = filters.search.trim().toLowerCase();
          combined = combined.filter(
            (l) =>
              (l.actor_name && l.actor_name.toLowerCase().includes(term)) ||
              (l.actor_email && l.actor_email.toLowerCase().includes(term)) ||
              (l.action && l.action.toLowerCase().includes(term)) ||
              (l.entity_id && l.entity_id.toLowerCase().includes(term)) ||
              (l.tenant_name && l.tenant_name.toLowerCase().includes(term)) ||
              JSON.stringify(l.new_data || {}).toLowerCase().includes(term)
          );
        }

        if (combined.length > 0) {
          return combined.slice(0, limit);
        }
      } catch (e) {
        console.warn("[MarketOS] Error fetching global audit logs from Supabase:", e);
      }
    }

    // Fallback to in-memory state
    let results = [...state.auditLogs];

    if (filters?.tenantId && filters.tenantId !== "ALL") {
      results = results.filter((l) => l.tenant_id === filters.tenantId);
    }
    if (filters?.action && filters.action !== "ALL") {
      results = results.filter((l) => l.action === filters.action);
    }
    if (filters?.actorId) {
      results = results.filter((l) => l.actor_id === filters.actorId);
    }
    if (filters?.startDate) {
      results = results.filter((l) => l.created_at >= filters.startDate!);
    }
    if (filters?.endDate) {
      results = results.filter((l) => l.created_at <= filters.endDate!);
    }
    if (filters?.search && filters.search.trim()) {
      const term = filters.search.trim().toLowerCase();
      results = results.filter(
        (l) =>
          (l.actor_name && l.actor_name.toLowerCase().includes(term)) ||
          (l.actor_email && l.actor_email.toLowerCase().includes(term)) ||
          (l.action && l.action.toLowerCase().includes(term)) ||
          (l.entity_id && l.entity_id.toLowerCase().includes(term)) ||
          (tenantMap.get(l.tenant_id) &&
            tenantMap.get(l.tenant_id)!.toLowerCase().includes(term)) ||
          JSON.stringify(l.new_data || {}).toLowerCase().includes(term)
      );
    }

    return results.slice(0, limit).map((l) => ({
      ...l,
      tenant_name:
        l.tenant_name ||
        tenantMap.get(l.tenant_id) ||
        (l.tenant_id === "platform" ? "Plataforma Central" : "Tienda"),
    }));
  }
}
