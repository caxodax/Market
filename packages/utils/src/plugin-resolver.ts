import type {
  TenantModuleId,
  PluginDependencyRule,
  ResolveDependenciesOptions,
  ResolveDependenciesResult,
} from "@marketos/types";

/**
 * Clean & resilient dependency resolution engine for MarketOS modular plugins (ECC & Ponytail)
 * Resolves cascading activations, cascading deactivations, and detects territorial conflicts.
 */
export function resolvePluginDependencies(
  options: ResolveDependenciesOptions
): ResolveDependenciesResult {
  const { moduleId, targetState, activeModuleIds, rules = [] } = options;

  const activeRules = rules.filter((r) => r.is_active);
  const autoActivatedMessages: string[] = [];

  if (targetState) {
    // ─── CASO: ACTIVACIÓN (CASCADE ENABLING & CONFLICTS RESOLUTION) ─────────
    const toActivate = new Set<TenantModuleId>([moduleId]);
    const toDeactivate = new Set<TenantModuleId>();

    // Cola de resolución recursiva / transitiva
    const queue: TenantModuleId[] = [moduleId];
    const visited = new Set<TenantModuleId>([moduleId]);

    while (queue.length > 0) {
      const current = queue.shift()!;

      // 1. Resolver requerimientos y auto-activaciones (current -> target)
      const depRules = activeRules.filter(
        (r) =>
          r.source_module_id === current &&
          (r.type === "REQUIRES" || r.type === "AUTO_ACTIVATE")
      );

      for (const rule of depRules) {
        const depId = rule.target_module_id;
        if (!activeModuleIds.includes(depId) && !toActivate.has(depId)) {
          toActivate.add(depId);
          autoActivatedMessages.push(
            `Módulo "${depId}" activado automáticamente como dependencia de "${current}".`
          );
          if (!visited.has(depId)) {
            visited.add(depId);
            queue.push(depId);
          }
        }
      }

      // 2. Resolver incompatibilidades y conflictos territoriales (current <-> target)
      const conflictRules = activeRules.filter(
        (r) =>
          r.type === "CONFLICTS" &&
          (r.source_module_id === current || r.target_module_id === current)
      );

      for (const rule of conflictRules) {
        const conflictingId =
          rule.source_module_id === current
            ? rule.target_module_id
            : rule.source_module_id;

        if (activeModuleIds.includes(conflictingId) || toActivate.has(conflictingId)) {
          // Desactivar el módulo incompatible para evitar colisión tributaria
          toDeactivate.add(conflictingId);
          toActivate.delete(conflictingId);
          autoActivatedMessages.push(
            `Módulo incompatible "${conflictingId}" desactivado al activar "${current}".`
          );
        }
      }
    }

    return {
      allowed: true,
      toActivate: Array.from(toActivate),
      toDeactivate: Array.from(toDeactivate),
      autoActivatedMessages,
    };
  } else {
    // ─── CASO: DESACTIVACIÓN (CASCADE DISABLING DE DEPENDIENTES) ────────────
    const toDeactivate = new Set<TenantModuleId>([moduleId]);
    const queue: TenantModuleId[] = [moduleId];

    while (queue.length > 0) {
      const current = queue.shift()!;

      // Buscar módulos activos que requieran de 'current' para funcionar
      const dependentRules = activeRules.filter(
        (r) =>
          r.target_module_id === current &&
          (r.type === "REQUIRES" || r.type === "AUTO_ACTIVATE")
      );

      for (const rule of dependentRules) {
        const dependentId = rule.source_module_id;
        if (activeModuleIds.includes(dependentId) && !toDeactivate.has(dependentId)) {
          toDeactivate.add(dependentId);
          autoActivatedMessages.push(
            `Módulo "${dependentId}" desactivado porque requiere de "${current}".`
          );
          queue.push(dependentId);
        }
      }
    }

    return {
      allowed: true,
      toActivate: [],
      toDeactivate: Array.from(toDeactivate),
      autoActivatedMessages,
    };
  }
}
