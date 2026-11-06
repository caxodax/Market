"use client";

import React, { useState, useEffect } from "react";
import {
  UserProfile,
  UserRole,
  STAFF_PERMISSIBLE_MODULES,
  DEFAULT_ROLE_PERMISSIONS,
  StaffModulePermissionDefinition,
} from "@marketos/types";
import { updateStaffPermissionsAction } from "../app/admin/actions";
import {
  X,
  Shield,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  RotateCcw,
  CheckSquare,
  Square,
  AlertCircle,
} from "lucide-react";

interface StaffPermissionsModalProps {
  tenantId: string;
  isOpen: boolean;
  onClose: () => void;
  staffMember: UserProfile | null;
  onPermissionsUpdated: (profileId: string, newPermissions: string[]) => void;
  callerRole?: UserRole;
}

export function StaffPermissionsModal({
  tenantId,
  isOpen,
  onClose,
  staffMember,
  onPermissionsUpdated,
  callerRole,
}: StaffPermissionsModalProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (staffMember) {
      if (staffMember.custom_permissions && staffMember.custom_permissions.length > 0) {
        setSelectedPermissions(staffMember.custom_permissions);
      } else {
        // Fall back to default permissions for role
        const defaults = DEFAULT_ROLE_PERMISSIONS[staffMember.role] || [];
        setSelectedPermissions(defaults);
      }
      setErrorMsg(null);
    }
  }, [staffMember]);

  if (!isOpen || !staffMember) return null;

  const togglePermission = (moduleId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId]
    );
  };

  const handleSelectAll = () => {
    setSelectedPermissions(STAFF_PERMISSIBLE_MODULES.map((m) => m.id));
  };

  const handleDeselectAll = () => {
    setSelectedPermissions([]);
  };

  const handleResetToRoleDefault = () => {
    const defaults = DEFAULT_ROLE_PERMISSIONS[staffMember.role] || [];
    setSelectedPermissions(defaults);
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await updateStaffPermissionsAction(
        tenantId,
        staffMember.id,
        selectedPermissions
      );

      if (!res.success) {
        throw new Error(res.error || "Error al actualizar los permisos");
      }

      onPermissionsUpdated(staffMember.id, selectedPermissions);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al guardar los permisos");
    } finally {
      setSaving(false);
    }
  };

  // Group modules by category
  const categories: {
    key: StaffModulePermissionDefinition["category"];
    label: string;
    icon: string;
  }[] = [
    { key: "OPERATIONS", label: "1. Operaciones & Despacho", icon: "⚡" },
    { key: "CATALOG", label: "2. Catálogo, Cocina & Marketing", icon: "📦" },
    { key: "FINANCE", label: "3. Finanzas, Caja & Facturación", icon: "💰" },
    { key: "MANAGEMENT", label: "4. Administración & Gobierno", icon: "🛡️" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-t-[28px] sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-sheet-enter sm:animate-in sm:zoom-in-95 duration-200">
        {/* Mobile drag handle */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden shrink-0 bg-muted/40">
          <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black text-foreground">
                  Permisos de Módulos (Sidebar)
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {staffMember.full_name}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Selecciona qué secciones del panel de administración puede ver y operar este colaborador.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-muted-foreground hover:bg-muted cursor-pointer transition-colors flex items-center justify-center"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar with quick actions */}
        <div className="px-5 py-2.5 border-b border-border bg-card/60 flex items-center justify-between flex-wrap gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-foreground">
              {selectedPermissions.length} de {STAFF_PERMISSIBLE_MODULES.length} módulos habilitados
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1 cursor-pointer transition-colors"
            >
              <CheckSquare className="w-3 h-3 text-emerald-500" />
              <span>Marcar Todos</span>
            </button>

            <button
              type="button"
              onClick={handleDeselectAll}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Square className="w-3 h-3" />
              <span>Desmarcar Todos</span>
            </button>

            <button
              type="button"
              onClick={handleResetToRoleDefault}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-border bg-background hover:bg-muted text-primary flex items-center gap-1 cursor-pointer transition-colors"
              title="Restablecer a la plantilla estándar para este rol"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restablecer por Rol</span>
            </button>
          </div>
        </div>

        {/* Error notice */}
        {errorMsg && (
          <div className="m-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Scrollable Checkbox Modules List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1 text-xs">
          {categories.map((cat) => {
            const catModules = STAFF_PERMISSIBLE_MODULES.filter(
              (m) => m.category === cat.key
            );
            const activeInCat = catModules.filter((m) =>
              selectedPermissions.includes(m.id)
            ).length;

            return (
              <div
                key={cat.key}
                className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs"
              >
                <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-foreground">
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-muted-foreground">
                    {activeInCat} / {catModules.length}
                  </span>
                </div>

                <div className="p-3 grid sm:grid-cols-2 gap-2">
                  {catModules.map((module) => {
                    const isChecked = selectedPermissions.includes(module.id);
                    return (
                      <label
                        key={module.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                          isChecked
                            ? "bg-emerald-500/5 border-emerald-500/30 text-foreground"
                            : "bg-background border-border text-muted-foreground hover:border-border/80"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePermission(module.id)}
                          className="mt-0.5 h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                        />
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="font-bold text-xs truncate flex items-center justify-between gap-1">
                            <span className={isChecked ? "text-foreground" : "text-muted-foreground"}>
                              {module.label}
                            </span>
                            {isChecked && (
                              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded shrink-0">
                                Visible
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground line-clamp-1">
                            {module.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-muted-foreground hidden sm:block">
            Los cambios se aplicarán de inmediato en el menú del colaborador.
          </p>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted text-xs font-bold cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Guardar Permisos</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
