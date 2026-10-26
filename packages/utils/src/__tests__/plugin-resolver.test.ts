import assert from "node:assert/strict";
import { resolvePluginDependencies } from "../plugin-resolver.ts";
import { DEFAULT_PLUGIN_DEPENDENCY_RULES } from "@marketos/types";
import type { PluginDependencyRule } from "@marketos/types";

console.log("▶ Running tests for Plugin Dependency Resolver...");

// ─── 1. TEST AUTO-ACTIVATE (INVOICING -> PURCHASING_RETENTIONS) ─────────────
console.log("  Testing auto-activation of dependency...");
{
  const res = resolvePluginDependencies({
    moduleId: "invoicing",
    targetState: true,
    activeModuleIds: ["local_venezuela"],
    rules: DEFAULT_PLUGIN_DEPENDENCY_RULES,
  });

  assert.equal(res.allowed, true);
  assert.ok(res.toActivate.includes("invoicing"), "Must activate target module");
  assert.ok(
    res.toActivate.includes("purchasing_retentions"),
    "Must auto-activate purchasing_retentions dependency"
  );
  assert.equal(res.toDeactivate.length, 0);
  assert.equal(res.autoActivatedMessages.length, 1);
  assert.ok(res.autoActivatedMessages[0].includes("purchasing_retentions"));
}

// ─── 2. TEST ALREADY ACTIVE DEPENDENCY (NO REDUNDANT ACTIVATION) ─────────────
console.log("  Testing already active dependency...");
{
  const res = resolvePluginDependencies({
    moduleId: "invoicing",
    targetState: true,
    activeModuleIds: ["purchasing_retentions", "local_venezuela"],
    rules: DEFAULT_PLUGIN_DEPENDENCY_RULES,
  });

  assert.equal(res.allowed, true);
  assert.deepEqual(res.toActivate, ["invoicing"]);
  assert.equal(res.autoActivatedMessages.length, 0, "No notification if already active");
}

// ─── 3. TEST CONFLICT RESOLUTION (VENEZUELA VS CHILE) ───────────────────────
console.log("  Testing conflict resolution...");
{
  // Activating Chile while Venezuela is active should deactivate Venezuela
  const res = resolvePluginDependencies({
    moduleId: "local_chile",
    targetState: true,
    activeModuleIds: ["local_venezuela", "invoicing"],
    rules: DEFAULT_PLUGIN_DEPENDENCY_RULES,
  });

  assert.equal(res.allowed, true);
  assert.ok(res.toActivate.includes("local_chile"));
  assert.ok(
    res.toDeactivate.includes("local_venezuela"),
    "Must auto-deactivate conflicting local_venezuela"
  );
  assert.ok(
    res.autoActivatedMessages.some((m) => m.includes("incompatible")),
    "Should include incompatibility message"
  );
}

// ─── 4. TEST CASCADING DEACTIVATION ─────────────────────────────────────────
console.log("  Testing cascading deactivation...");
{
  // Deactivating purchasing_retentions when invoicing is active and depends on it
  const res = resolvePluginDependencies({
    moduleId: "purchasing_retentions",
    targetState: false,
    activeModuleIds: ["invoicing", "purchasing_retentions"],
    rules: DEFAULT_PLUGIN_DEPENDENCY_RULES,
  });

  assert.equal(res.allowed, true);
  assert.ok(res.toDeactivate.includes("purchasing_retentions"));
  assert.ok(
    res.toDeactivate.includes("invoicing"),
    "Must cascade deactivation to invoicing because it requires purchasing_retentions"
  );
}

// ─── 5. TEST TRANSITIVE DEPENDENCY (A -> B -> C) ───────────────────────────
console.log("  Testing transitive multi-hop dependencies (A -> B -> C)...");
{
  const customRules: PluginDependencyRule[] = [
    {
      id: "r1",
      source_module_id: "mto_cpq",
      target_module_id: "invoicing",
      type: "REQUIRES",
      is_active: true,
    },
    {
      id: "r2",
      source_module_id: "invoicing",
      target_module_id: "purchasing_retentions",
      type: "AUTO_ACTIVATE",
      is_active: true,
    },
  ];

  const res = resolvePluginDependencies({
    moduleId: "mto_cpq",
    targetState: true,
    activeModuleIds: [],
    rules: customRules,
  });

  assert.ok(res.toActivate.includes("mto_cpq"));
  assert.ok(res.toActivate.includes("invoicing"));
  assert.ok(res.toActivate.includes("purchasing_retentions"));
  assert.equal(res.toActivate.length, 3);
}

// ─── 6. TEST INACTIVE RULE IS IGNORED ───────────────────────────────────────
console.log("  Testing inactive rules are ignored...");
{
  const disabledRule: PluginDependencyRule[] = [
    {
      id: "disabled_r",
      source_module_id: "invoicing",
      target_module_id: "purchasing_retentions",
      type: "AUTO_ACTIVATE",
      is_active: false, // OFF
    },
  ];

  const res = resolvePluginDependencies({
    moduleId: "invoicing",
    targetState: true,
    activeModuleIds: [],
    rules: disabledRule,
  });

  assert.deepEqual(res.toActivate, ["invoicing"], "Should only activate invoicing if rule is inactive");
}

console.log("✅ All Plugin Dependency Resolver checks passed successfully!");
