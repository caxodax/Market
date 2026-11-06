"use client";

import React, { useState } from "react";
import {
  UserProfile,
  UserRole,
  TenantSettings,
} from "@marketos/types";
import {
  updateStaffRoleAction,
  revokeStaffMemberAction,
  resetStaffPasswordAction,
  updateTenantSettingsAction,
} from "@/app/admin/actions";
import { toast } from "sonner";
import {
  ShieldCheck,
  Users,
  Key,
  Shield,
  UserX,
  Loader2,
  Lock,
} from "lucide-react";
import { ROLE_LABELS, StaffModal } from "./staff-modal";
import { StaffPermissionsModal } from "./staff-permissions-modal";

interface StaffViewProps {
  initialStaff: UserProfile[];
  settings: TenantSettings;
  currentUser: UserProfile;
}

export function StaffView({
  initialStaff,
  settings,
  currentUser,
}: StaffViewProps) {
  const [staff, setStaff] = useState<UserProfile[]>(initialStaff);
  const [updatingStaffId, setUpdatingStaffId] = useState<string | null>(null);
  const [revokingStaffId, setRevokingStaffId] = useState<string | null>(null);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [permissionsModalStaff, setPermissionsModalStaff] = useState<UserProfile | null>(null);
  const [passwordModalStaff, setPasswordModalStaff] = useState<UserProfile | null>(null);
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const handleRoleChange = async (profileId: string, newRole: UserRole) => {
    setUpdatingStaffId(profileId);
    try {
      const res = await updateStaffRoleAction(settings.tenant_id, profileId, newRole);
      if (res?.success && res.profile) {
        setStaff((prev) =>
          prev.map((s) => (s.id === profileId ? res.profile! : s))
        );
        toast.success("Rol de colaborador actualizado");
      } else {
        toast.error(res?.error || "Error al actualizar rol");
      }
    } catch {
      toast.error("Error de comunicación al actualizar rol");
    } finally {
      setUpdatingStaffId(null);
    }
  };

  const handleRevokeStaff = async (profileId: string, name: string) => {
    if (!window.confirm(`¿Estás seguro de revocar el acceso a ${name}?`)) return;

    setRevokingStaffId(profileId);
    try {
      const res = await revokeStaffMemberAction(settings.tenant_id, profileId);
      if (res?.success) {
        setStaff((prev) => prev.filter((s) => s.id !== profileId));
        toast.success(`Acceso revocado a ${name}`);
      } else {
        toast.error(res?.error || "Error al revocar colaborador");
      }
    } catch {
      toast.error("Error al revocar acceso");
    } finally {
      setRevokingStaffId(null);
    }
  };

  const handleResetPassword = async () => {
    if (!passwordModalStaff || !newStaffPassword || newStaffPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setIsResettingPassword(true);
    try {
      const res = await resetStaffPasswordAction(
        settings.tenant_id,
        passwordModalStaff.id,
        newStaffPassword
      );
      if (res?.success) {
        toast.success(`Contraseña de ${passwordModalStaff.full_name} actualizada`);
        setPasswordModalStaff(null);
        setNewStaffPassword("");
      } else {
        toast.error(res?.error || "Error al actualizar contraseña");
      }
    } catch {
      toast.error("Error al actualizar contraseña");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const getBadgeClass = (r: UserRole) => {
    switch (r) {
      case "PLATFORM_SUPER_ADMIN":
        return "bg-rose-500/10 text-rose-500 border-rose-500/20";
      case "TENANT_OWNER":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "TENANT_MANAGER":
        return "bg-teal-500/10 text-teal-500 border-teal-500/20";
      case "TENANT_CASHIER":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "TENANT_INVENTORY":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "TENANT_DELIVERY":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 animate-view-enter">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Equipo de Trabajo & Permisos (RBAC)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gestiona colaboradores, asigna roles jerárquicos y audita permisos en tiempo real.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsStaffModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-sm cursor-pointer transition-all shrink-0 active:scale-95"
        >
          <Users className="w-4 h-4" />
          <span>+ Asignar Colaborador</span>
        </button>
      </div>

      {/* Staff list */}
      <div className="grid gap-3">
        {staff.map((member) => {
          const roleInfo = ROLE_LABELS[member.role] || {
            label: member.role,
            desc: "Sin descripción",
          };

          return (
            <div
              key={member.id}
              className="p-4 rounded-2xl border border-border bg-card flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all shadow-2xs hover:border-primary/30"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600/20 to-teal-600/20 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-500 text-sm shrink-0">
                  {member.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-foreground">
                      {member.full_name}
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getBadgeClass(
                        member.role
                      )}`}
                    >
                      {roleInfo.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {member.email} {member.phone && `• ${member.phone}`}
                  </p>
                  <p className="text-[11px] text-muted-foreground/80">
                    {roleInfo.desc}
                  </p>

                  {/* Visible module permissions */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] font-semibold text-muted-foreground">Permisos:</span>
                    {member.custom_permissions && member.custom_permissions.length > 0 ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        <span>Personalizado ({member.custom_permissions.length} módulos)</span>
                      </span>
                    ) : member.role === "TENANT_OWNER" || member.role === "PLATFORM_SUPER_ADMIN" ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 font-bold border border-emerald-500/20">
                        Control Total Irrestricto
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
                        Por rol jerárquico
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-3 md:pt-0 border-t md:border-t-0 border-border">
                <div className="flex items-center gap-1.5">
                  <label className="text-[11px] text-muted-foreground font-semibold">
                    Rol:
                  </label>
                  <select
                    value={member.role}
                    disabled={
                      updatingStaffId === member.id ||
                      revokingStaffId === member.id ||
                      member.id === currentUser?.id ||
                      (member.role === "TENANT_OWNER" &&
                        currentUser?.role !== "PLATFORM_SUPER_ADMIN" &&
                        currentUser?.role !== "TENANT_OWNER")
                    }
                    onChange={(e) =>
                      handleRoleChange(member.id, e.target.value as UserRole)
                    }
                    className="bg-muted border border-border text-foreground text-xs rounded-xl px-2.5 py-1.5 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 cursor-pointer"
                  >
                    {(currentUser?.role === "PLATFORM_SUPER_ADMIN" ||
                      currentUser?.role === "TENANT_OWNER") && (
                      <option value="TENANT_OWNER">Dueño del Comercio</option>
                    )}
                    <option value="TENANT_MANAGER">Encargada de Sucursal</option>
                    <option value="TENANT_CASHIER">Cajero / Operador</option>
                    <option value="TENANT_INVENTORY">Control de Inventario</option>
                    <option value="TENANT_DELIVERY">Repartidor / Delivery</option>
                  </select>
                </div>

                {/* Password Reset Button */}
                <button
                  type="button"
                  onClick={() => {
                    setPasswordModalStaff(member);
                    setNewStaffPassword("");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-primary hover:bg-primary/10 border border-border hover:border-primary/20 transition-all cursor-pointer"
                  title="Cambiar contraseña de acceso"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clave</span>
                </button>

                {/* Granular Permissions Button */}
                <button
                  type="button"
                  onClick={() => setPermissionsModalStaff(member)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border border-border hover:border-emerald-500/20 transition-all cursor-pointer"
                  title="Personalizar accesos y módulos"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Permisos</span>
                </button>

                {/* Revoke Button */}
                {member.id !== currentUser?.id && member.role !== "TENANT_OWNER" && (
                  <button
                    type="button"
                    disabled={revokingStaffId === member.id || updatingStaffId === member.id}
                    onClick={() => handleRevokeStaff(member.id, member.full_name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 border border-border hover:border-rose-500/20 transition-all cursor-pointer disabled:opacity-50"
                    title="Revocar acceso"
                  >
                    {revokingStaffId === member.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UserX className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">Revocar</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Staff Invitation Modal */}
      {isStaffModalOpen && (
        <StaffModal
          tenantId={settings.tenant_id}
          isOpen={isStaffModalOpen}
          onClose={() => setIsStaffModalOpen(false)}
          onStaffAdded={(invited: UserProfile) => {
            setStaff((prev) => [invited, ...prev]);
            setIsStaffModalOpen(false);
            toast.success("Colaborador asignado correctamente");
          }}
        />
      )}

      {/* Granular Permissions Modal */}
      {permissionsModalStaff && (
        <StaffPermissionsModal
          tenantId={settings.tenant_id}
          staffMember={permissionsModalStaff}
          isOpen={Boolean(permissionsModalStaff)}
          onClose={() => setPermissionsModalStaff(null)}
          onPermissionsUpdated={(_profileId: string, updatedPermissions: string[]) => {
            setStaff((prev) =>
              prev.map((s) =>
                s.id === permissionsModalStaff.id
                  ? { ...s, custom_permissions: updatedPermissions }
                  : s
              )
            );
            setPermissionsModalStaff(null);
            toast.success("Permisos de colaborador actualizados");
          }}
        />
      )}

      {/* Password Reset Modal */}
      {passwordModalStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card w-full max-w-sm rounded-3xl p-6 border border-border shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-base text-foreground">
                  Cambiar Contraseña
                </h3>
                <p className="text-xs text-muted-foreground">
                  Para {passwordModalStaff.full_name}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                Nueva Contraseña
              </label>
              <input
                type="password"
                placeholder="Mínimo 6 caracteres..."
                value={newStaffPassword}
                onChange={(e) => setNewStaffPassword(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPasswordModalStaff(null)}
                className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isResettingPassword || !newStaffPassword}
                onClick={handleResetPassword}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-black shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isResettingPassword ? "Guardando..." : "Guardar Clave"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
